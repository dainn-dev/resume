namespace DResume.Api.Common;

public sealed record ApiResult<T>(bool Success, T? Data, string? Error)
{
    public static ApiResult<T> Ok(T data) => new(true, data, null);
    public static ApiResult<T> Fail(string error) => new(false, default, error);
}

public static class ApiResult
{
    public static ApiResult<T> Ok<T>(T data) => ApiResult<T>.Ok(data);
    public static ApiResult<object> Fail(string error) => new(false, null, error);
}
