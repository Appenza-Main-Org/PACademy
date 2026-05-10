using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using PACademy.Modules.Identity.Application.Officers;
using Polly;
using Polly.CircuitBreaker;
using Polly.Retry;
using Polly.Timeout;

namespace PACademy.Modules.Identity.Infrastructure.Officers;

public sealed class MoipassOfficerLookup : IOfficerLookup
{
    private readonly HttpClient _http;
    private readonly ResiliencePipeline<OfficerRecord?> _pipeline;

    public MoipassOfficerLookup(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _http = httpClientFactory.CreateClient("Moipass");
        _http.BaseAddress = new Uri(configuration["OfficerLookup:Moipass:BaseUrl"]!);
        _http.DefaultRequestHeaders.Add("X-Api-Key", configuration["OfficerLookup:Moipass:ApiKey"]);

        _pipeline = new ResiliencePipelineBuilder<OfficerRecord?>()
            .AddTimeout(new TimeoutStrategyOptions { Timeout = TimeSpan.FromSeconds(5) })
            .AddRetry(new RetryStrategyOptions<OfficerRecord?>
            {
                MaxRetryAttempts = 2,
                Delay = TimeSpan.FromMilliseconds(200),
                BackoffType = DelayBackoffType.Linear,
                ShouldHandle = new PredicateBuilder<OfficerRecord?>().Handle<HttpRequestException>(),
            })
            .AddCircuitBreaker(new CircuitBreakerStrategyOptions<OfficerRecord?>
            {
                FailureRatio = 0.5,
                MinimumThroughput = 5,
                SamplingDuration = TimeSpan.FromSeconds(30),
                BreakDuration = TimeSpan.FromSeconds(60),
                ShouldHandle = new PredicateBuilder<OfficerRecord?>().Handle<HttpRequestException>(),
            })
            .Build();
    }

    public async Task<OfficerRecord?> LookupAsync(string nationalId, string officerCode, CancellationToken ct = default)
    {
        try
        {
            return await _pipeline.ExecuteAsync(async (cancellation) =>
            {
                var response = await _http.GetAsync(
                    $"officers/lookup?nid={Uri.EscapeDataString(nationalId)}&code={Uri.EscapeDataString(officerCode)}",
                    cancellation);

                if (response.StatusCode == System.Net.HttpStatusCode.NotFound) return null;

                response.EnsureSuccessStatusCode();

                var dto = await response.Content.ReadFromJsonAsync<MoipassOfficerDto>(cancellation);
                if (dto is null) return null;

                return new OfficerRecord(
                    dto.NationalId, dto.OfficerCode, dto.FullName,
                    dto.Mobile, dto.Email, dto.IssueDate, dto.CardFactoryNumber, dto.Unit);
            }, ct);
        }
        catch (BrokenCircuitException ex)
        {
            throw new OfficerLookupUnavailableException("MOIPASS circuit breaker is open.", ex);
        }
        catch (TimeoutRejectedException ex)
        {
            throw new OfficerLookupUnavailableException("MOIPASS request timed out.", ex);
        }
        catch (HttpRequestException ex)
        {
            throw new OfficerLookupUnavailableException("MOIPASS is unreachable.", ex);
        }
    }

    private sealed record MoipassOfficerDto(
        string NationalId,
        string OfficerCode,
        string FullName,
        string Mobile,
        string Email,
        DateTime IssueDate,
        string CardFactoryNumber,
        string Unit);
}
