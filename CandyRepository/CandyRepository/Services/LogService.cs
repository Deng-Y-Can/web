using CandyRepository.Data;
using CandyRepository.Models;
using CandyRepository.Services;
using Microsoft.EntityFrameworkCore;

public class LogService : ILogService
{
    private readonly ApplicationDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IConfiguration _configuration;

    public LogService(
        ApplicationDbContext context,
        IHttpContextAccessor httpContextAccessor,
        IConfiguration configuration)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
        _configuration = configuration;
    }

    public async Task LogAsync(int userId, OperationType operationType, string operation, string details, string? ipAddress = null)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        var ip = ipAddress ?? httpContext?.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
        var userAgent = httpContext?.Request.Headers["User-Agent"].ToString();

        var log = new OperationLog
        {
            UserId = userId,
            OperationType = operationType,
            TargetPath = operation,
            Details = details,
            IPAddress = ip,
            UserAgent = userAgent,
            OperationTime = DateTime.UtcNow
        };

        _context.OperationLogs.Add(log);
        await _context.SaveChangesAsync();
    }

    public async Task<List<OperationLog>> GetUserLogsAsync(int userId, DateTime? startDate = null, DateTime? endDate = null, OperationType? operationType = null)
    {
        var query = _context.OperationLogs
            .Include(l => l.User)
            .Where(l => l.UserId == userId);

        if (startDate.HasValue)
            query = query.Where(l => l.OperationTime >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(l => l.OperationTime <= endDate.Value);

        if (operationType.HasValue)
            query = query.Where(l => l.OperationType == operationType.Value);

        return await query
            .OrderByDescending(l => l.OperationTime)
            .Take(1000)
            .ToListAsync();
    }

    public async Task<List<OperationLog>> GetAllLogsAsync(DateTime? startDate = null, DateTime? endDate = null, OperationType? operationType = null, int? userId = null)
    {
        var query = _context.OperationLogs
            .Include(l => l.User)
            .AsQueryable();

        if (startDate.HasValue)
            query = query.Where(l => l.OperationTime >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(l => l.OperationTime <= endDate.Value);

        if (operationType.HasValue)
            query = query.Where(l => l.OperationType == operationType.Value);

        if (userId.HasValue)
            query = query.Where(l => l.UserId == userId.Value);

        return await query
            .OrderByDescending(l => l.OperationTime)
            .Take(5000)
            .ToListAsync();
    }

    public async Task<byte[]> ExportLogsAsync(DateTime? startDate = null, DateTime? endDate = null, OperationType? operationType = null, int? userId = null)
    {
        var logs = await GetAllLogsAsync(startDate, endDate, operationType, userId);

        var csv = new System.Text.StringBuilder();
        csv.AppendLine("操作时间,用户,操作类型,操作内容,详情,IP地址");

        foreach (var log in logs)
        {
            csv.AppendLine($"\"{log.OperationTime:yyyy-MM-dd HH:mm:ss}\",\"{log.User?.Username}\",\"{log.OperationType}\",\"{log.TargetPath}\",\"{log.Details?.Replace("\"", "\"\"")}\",\"{log.IPAddress}\"");
        }

        return System.Text.Encoding.UTF8.GetBytes(csv.ToString());
    }

    public async Task CleanOldLogsAsync(int retentionDays)
    {
        var cutoffDate = DateTime.UtcNow.AddDays(-retentionDays);
        var oldLogs = await _context.OperationLogs
            .Where(l => l.OperationTime < cutoffDate)
            .ToListAsync();

        _context.OperationLogs.RemoveRange(oldLogs);
        await _context.SaveChangesAsync();
    }
}