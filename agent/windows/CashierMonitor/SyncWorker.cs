using System.Text;
using System.Text.Json;

namespace CashierMonitor;

public sealed class SyncWorker
{
    private const int MaxPayloadBytes = 2_500_000;
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

        batch = LimitBatchSize(batch);

        var payload = new LogBatch
        {
            MachineId = _config.MachineId,
            Events = batch,
        };

        var json = JsonSerializer.Serialize(payload, AgentJsonContext.Default.LogBatch);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        using var response = await _httpClient.PostAsync(
            _config.ServerUrl,
            content,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Server returned {(int)response.StatusCode}: {body}");
        }

        _queue.RemoveSent(batch.Count);
        AgentLog.Info($"Synced {batch.Count} events");
    }

    private List<ActivityEvent> LimitBatchSize(List<ActivityEvent> batch)
    {
        var currentBatch = batch;

        while (currentBatch.Count > 1)
        {
            var payload = new LogBatch
            {
                MachineId = _config.MachineId,
                Events = currentBatch,
            };

            var json = JsonSerializer.Serialize(payload, AgentJsonContext.Default.LogBatch);
            var payloadBytes = Encoding.UTF8.GetByteCount(json);
            if (payloadBytes <= MaxPayloadBytes)
            {
                return currentBatch;
            }

            currentBatch = currentBatch
                .Take(Math.Max(1, currentBatch.Count / 2))
                .ToList();
        }

        return currentBatch;
    }
}
