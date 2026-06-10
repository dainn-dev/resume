using System.Security.Cryptography;
using System.Text;

namespace DResume.Api.Common.Encryption;

/// <summary>
/// Application-level encryption for sensitive PII columns (AES-256-GCM).
/// Stored format: "enc:v1:" + base64(nonce[12] || tag[16] || ciphertext).
/// Decrypt is tolerant: values without the prefix are treated as legacy plaintext and
/// returned as-is, which lets the one-time backfill migrate existing rows without a hard cutover.
/// PII encryption is MANDATORY: a missing or invalid Encryption:Key makes construction throw
/// (<see cref="ResolveKey"/>), so the application refuses to start rather than silently persisting
/// resume rawtext and bank account numbers as plaintext.
/// </summary>
public interface IFieldEncryptor
{
    bool Enabled { get; }
    string Encrypt(string plaintext);
    string Decrypt(string stored);
}

public sealed class AesFieldEncryptor : IFieldEncryptor
{
    public const string Prefix = "enc:v1:";
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private readonly byte[] _key;

    // Always true once constructed — construction throws when no usable key is configured.
    public bool Enabled => true;

    public AesFieldEncryptor(IConfiguration config)
    {
        _key = ResolveKey(config);
    }

    /// <summary>
    /// Validates that a usable base64-encoded 32-byte AES-256 key is configured and returns its bytes.
    /// Throws <see cref="InvalidOperationException"/> with a clear, actionable message when the key is
    /// missing or malformed — PII field encryption is mandatory, so a bad key must fail startup instead
    /// of silently downgrading to plaintext storage.
    /// </summary>
    public static byte[] ResolveKey(IConfiguration config)
    {
        var raw = config["Encryption:Key"];
        if (string.IsNullOrWhiteSpace(raw))
        {
            throw new InvalidOperationException(
                "Encryption:Key is not configured. PII field encryption is mandatory — set a base64-encoded " +
                "32-byte key (generate with `openssl rand -base64 32`) before starting the application. " +
                "Refusing to start to avoid silently persisting PII (resume rawtext, bank account numbers) as plaintext.");
        }

        byte[] key;
        try
        {
            key = Convert.FromBase64String(raw);
        }
        catch (FormatException)
        {
            throw new InvalidOperationException(
                "Encryption:Key is not valid base64. Provide a base64-encoded 32-byte key (generate with `openssl rand -base64 32`).");
        }

        if (key.Length != 32)
        {
            throw new InvalidOperationException(
                $"Encryption:Key must decode to 32 bytes for AES-256 (got {key.Length}). Generate one with `openssl rand -base64 32`.");
        }

        return key;
    }

    /// <summary>
    /// Fail-fast guard for application startup: validates Encryption:Key and throws if it is missing
    /// or invalid. Call this early in Program.cs so the failure surfaces with a clear message before
    /// any database work runs.
    /// </summary>
    public static void EnsureKeyConfigured(IConfiguration config) => ResolveKey(config);

    public string Encrypt(string plaintext)
    {
        if (string.IsNullOrEmpty(plaintext)) return plaintext;

        var data = Encoding.UTF8.GetBytes(plaintext);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var cipher = new byte[data.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(_key, TagSize);
        aes.Encrypt(nonce, data, cipher, tag);

        var blob = new byte[NonceSize + TagSize + cipher.Length];
        Buffer.BlockCopy(nonce, 0, blob, 0, NonceSize);
        Buffer.BlockCopy(tag, 0, blob, NonceSize, TagSize);
        Buffer.BlockCopy(cipher, 0, blob, NonceSize + TagSize, cipher.Length);
        return Prefix + Convert.ToBase64String(blob);
    }

    public string Decrypt(string stored)
    {
        if (string.IsNullOrEmpty(stored)) return stored;
        if (!stored.StartsWith(Prefix, StringComparison.Ordinal)) return stored; // legacy plaintext

        var blob = Convert.FromBase64String(stored[Prefix.Length..]);
        var nonce = blob.AsSpan(0, NonceSize);
        var tag = blob.AsSpan(NonceSize, TagSize);
        var cipher = blob.AsSpan(NonceSize + TagSize);
        var plain = new byte[cipher.Length];

        using var aes = new AesGcm(_key, TagSize);
        aes.Decrypt(nonce, cipher, tag, plain);
        return Encoding.UTF8.GetString(plain);
    }
}
