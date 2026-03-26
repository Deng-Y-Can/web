using CandyNote.Models;

namespace CandyNote.Services
{
    public interface IUserService
    {
        Task<User?> AuthenticateAsync(string username, string password);
        Task<User> CreateUserAsync(string username, string password, bool isAdmin = false);
        Task<bool> UpdateUserAsync(int userId, string? newUsername, string? newPassword);
        Task<bool> DeleteUserAsync(int userId);
        Task<List<User>> GetAllUsersAsync();
        Task<User?> GetUserByIdAsync(int userId);
        Task InitializeDefaultUsersAsync();
    }
}