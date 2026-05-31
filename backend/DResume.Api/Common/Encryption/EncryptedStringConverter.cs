using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace DResume.Api.Common.Encryption;

/// <summary>
/// EF Core value converter that transparently encrypts on write and decrypts on read.
/// EF skips the converter for null values, so nullable columns keep storing NULL.
/// </summary>
public sealed class EncryptedStringConverter : ValueConverter<string, string>
{
    public EncryptedStringConverter(IFieldEncryptor enc)
        : base(v => enc.Encrypt(v), v => enc.Decrypt(v))
    {
    }
}
