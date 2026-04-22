using System.Net.Http.Json;

namespace CashierMonitor;

public sealed class SyncWorker
{
    private readonly AgentConfig _config;
    private readonly EventQueue _queue;
    private readonly HttpClient _httpClient;

    public SyncWorker(AgentConfig config, EventQueue queue)
    {
        _config = config;
        _queue = queue;
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(15),
        };
        _httpClient.DefaultRequestHeaders.Add("X-Agent-Key", config.ApiKey);
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await FlushOnceAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                AgentLog.Error(exception, "Sync failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(_config.SyncIntervalSeconds), cancellationToken);
        }
    }

    private async Task FlushOnceAsync(CancellationToken cancellationToken)
    {
        var batch = _queue.PeekBatch(_config.MaxBatchSize);
        if (batch.Count == 0) return;

        var payload = new LogBatch
        {
            MachineId = _config.MachineId,
            Events = batch,
        };

        using var response = await _httpClient.PostAsJsonAsync(
            _config.ServerUrl,
            payload,
            AgentJsonContext.Default.LogBatch,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Server returned {(int)response.StatusCode}: {body}");
        }

        _queue.RemoveSent(batch.Count);
        AgentLog.Info($"Synced {batch.Count} events");
    }
}
