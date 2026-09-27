using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace InventoryPrintHelper;

public sealed class ApiClient : IPrintJobApi, IDisposable
{
    private readonly HttpClient _http;
    private readonly string _storeId;
    private readonly string _terminalName;
    private readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    public ApiClient(string apiBaseUrl, string token, string storeId, string terminalName, TimeSpan? timeout = null, HttpMessageHandler? handler = null)
    {
        _http = handler is null ? new HttpClient() : new HttpClient(handler);
        _http.BaseAddress = new Uri(apiBaseUrl.TrimEnd('/') + "/");
        _http.Timeout = timeout ?? TimeSpan.FromSeconds(10);
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        _storeId = storeId;
        _terminalName = terminalName;
    }

    public async Task<ClaimedPrintJob?> ClaimAsync(CancellationToken cancellationToken)
    {
        var data = await PostAsync<ClaimData>(new { action = "claim", storeId = _storeId, terminalName = _terminalName }, cancellationToken);
        return data.Item is null ? null : new ClaimedPrintJob(data.Item, data.ClaimToken ?? "");
    }

    public Task MarkPrintedAsync(string id, string claimToken, CancellationToken cancellationToken) =>
        FinishAsync("printed", id, claimToken, "", cancellationToken);

    public Task MarkFailedAsync(string id, string claimToken, string error, CancellationToken cancellationToken) =>
        FinishAsync("failed", id, claimToken, error, cancellationToken);

    public Task MarkUncertainAsync(string id, string claimToken, string error, CancellationToken cancellationToken) =>
        FinishAsync("uncertain", id, claimToken, error, cancellationToken);

    public async Task<IReadOnlyList<PrintJob>> ListAsync(CancellationToken cancellationToken)
    {
        using var response = await _http.GetAsync($"inventory-issue-print-jobs.php?storeId={Uri.EscapeDataString(_storeId)}&limit=200", cancellationToken);
        return (await ReadAsync<ListData>(response, cancellationToken)).Items;
    }

    public Task RetryAsync(string id, CancellationToken cancellationToken) => PostWithoutResultAsync(new { action = "retry", storeId = _storeId, id }, cancellationToken);
    public Task CancelAsync(string id, CancellationToken cancellationToken) => PostWithoutResultAsync(new { action = "cancel", storeId = _storeId, id }, cancellationToken);

    public async Task<int> CancelAllAsync(CancellationToken cancellationToken)
    {
        var data = await PostAsync<CancelAllData>(new { action = "cancel-all", storeId = _storeId }, cancellationToken);
        return data.Cancelled;
    }

    private Task FinishAsync(string action, string id, string claimToken, string error, CancellationToken cancellationToken) =>
        PostWithoutResultAsync(new { action, storeId = _storeId, id, claimToken, terminalName = _terminalName, error }, cancellationToken);

    private async Task PostWithoutResultAsync(object body, CancellationToken cancellationToken) =>
        _ = await PostAsync<JsonElement>(body, cancellationToken);

    private async Task<T> PostAsync<T>(object body, CancellationToken cancellationToken)
    {
        using var response = await _http.PostAsJsonAsync("inventory-issue-print-jobs.php", body, _json, cancellationToken);
        return await ReadAsync<T>(response, cancellationToken);
    }

    private async Task<T> ReadAsync<T>(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<T>>(_json, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope is null || !envelope.Ok)
            throw new HttpRequestException(envelope?.Error ?? $"API returned HTTP {(int)response.StatusCode}");
        return envelope.Data!;
    }

    public void Dispose() => _http.Dispose();

    private sealed record ApiEnvelope<T>(bool Ok, T? Data, string? Error);
    private sealed record ClaimData(PrintJob? Item, string? ClaimToken);
    private sealed record ListData(IReadOnlyList<PrintJob> Items);
    private sealed record CancelAllData(int Cancelled);
}
