using System.Security.Cryptography;
using System.Text;

namespace DResume.Api.Common.Encryption;

/// <summary>
/// Application-level encryption for sensitive PII columns (AES-256-GCM).
/// Stored format: "enc:v1:" + base64(nonce[12] || tag[16] || ciphertext).
/// Decrypt is tolerant: values without the prefix are treated as legacy plaintext and
/// returned as-is, which lets the one-time backfill migrate existing rows without a hard cutover.
/// When no key is configured the encryptor is disabled (pure passthrough) so dev works without setup.
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

    private readonly byte[]? _key;

    public bool Enabled => _key is not null;

    public AesFieldEncryptor(IConfiguration config, ILogger<AesFieldEncryptor>? logger = null)
    {
        var raw = config["Encryption:Key"];
        if (string.IsNullOrWhiteSpace(raw))
        {
            logger?.LogWarning("Encryption:Key not set — PII field encryption is DISABLED (values stored as plaintext).");
            return;
        }
        try
        {
            var key = Convert.FromBase64String(raw);
            if (key.Length == 32) _key = key;
            else logger?.LogError("Encryption:Key must decode to 32 bytes (got {Len}). Field encryption DISABLED.", key.Length);
        }
        catch (FormatException)
        {
            logger?.LogError("Encryption:Key is not valid base64. Field encryption DISABLED.");
        }
    }

    public string Encrypt(string plaintext)
    {
        if (_key is null || string.IsNullOrEmpty(plaintext)) return plaintext;

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
        if (_key is null || string.IsNullOrEmpty(stored)) return stored;
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
