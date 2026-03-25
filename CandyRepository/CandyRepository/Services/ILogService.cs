using Microsoft.EntityFrameworkCore;
using CandyRepository.Data;
using CandyRepository.Models;

namespace CandyRepository.Services
{
    public interface ILogService
    {
        Task LogAsync(int userId, OperationType operationType, string operation, string details, string? ipAddress = null);
        Task<List<OperationLog>> GetUserLogsAsync(int userId, DateTime? startDate = null, DateTime? endDate = null, OperationType? operationType = null);
        Task<List<OperationLog>> GetAllLogsAsync(DateTime? startDate = null, DateTime? endDate = null, OperationType? operationType = null, int? userId = null);
        Task<byte[]> ExportLogsAsync(DateTime? startDate = null, DateTime? endDate = null, OperationType? operationType = null, int? userId = null);
        Task CleanOldLogsAsync(int retentionDays);
    }

    
}