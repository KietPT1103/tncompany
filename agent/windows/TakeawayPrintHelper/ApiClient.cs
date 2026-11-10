using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace TakeawayPrintHelper;
public sealed class ApiClient(string baseUrl,string token,string storeId):IJobApi,IDisposable
{
    private readonly HttpClient http=Create(baseUrl,token);
    private static readonly JsonSerializerOptions Json=new(JsonSerializerDefaults.Web);
    static HttpClient Create(string url,string token) {
        var client=new HttpClient {BaseAddress=new Uri(url.TrimEnd('/')+"/"),Timeout=TimeSpan.FromSeconds(15)};
        client.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",token);return client;
    }
    public static async Task<string> LoginAsync(string url,string login,string password) {
        using var client=Create(url,"");
        using var response=await client.PostAsJsonAsync("auth.php?action=login",new{login,password});
        var data=await ReadAsync(response);return data.GetProperty("token").GetString()!;
    }
    public async Task<JsonElement> PostAsync(object body) {
        using var response=await http.PostAsJsonAsync("takeaway-print-jobs.php",body);
        return await ReadAsync(response);
    }
    public async Task<Claim?> ClaimAsync(string[] kinds) {
        var data=await PostAsync(new{action="claim",storeId,terminalName=Environment.MachineName,kinds});
        return data.GetProperty("item").ValueKind==JsonValueKind.Null?null:data.Deserialize<Claim>(Json);
    }
    public async Task FinishAsync(Completion c)=>_ =await PostAsync(new{action=c.Status,storeId,id=c.Id,claimToken=c.ClaimToken,error=c.Error});
    public async Task<Job[]> ListAsync(int offset=0) {
        using var response=await http.GetAsync("takeaway-print-jobs.php?storeId="+Uri.EscapeDataString(storeId)+"&offset="+offset);
        return (await ReadAsync(response)).GetProperty("items").Deserialize<Job[]>(Json)??[];
    }
    public static async Task<(string Id,string Name)[]> StoresAsync(string url,string token) {
        using var client=Create(url,token);using var response=await client.GetAsync("stores.php");
        return (await ReadAsync(response)).GetProperty("items").EnumerateArray()
            .Where(x=>x.GetProperty("isTakeAway").GetBoolean()).Select(x=>(x.GetProperty("id").GetString()!,x.GetProperty("name").GetString()!)).ToArray();
    }
    static async Task<JsonElement> ReadAsync(HttpResponseMessage response) {
        using var json=JsonDocument.Parse(await response.Content.ReadAsStringAsync());var root=json.RootElement;
        if(!response.IsSuccessStatusCode || !root.GetProperty("ok").GetBoolean())
            throw new HttpRequestException(root.TryGetProperty("error",out var e)?e.GetString():"API error",null,response.StatusCode);
        return root.GetProperty("data").Clone();
    }
    public void Dispose()=>http.Dispose();
}
