using BCryptNet = BCrypt.Net.BCrypt;

namespace CandyPlayer.Services
{
    public class PasswordService
    {
        public string HashPassword(string password)
        {
            return BCryptNet.HashPassword(password, workFactor: 12);
        }

        public bool VerifyPassword(string password, string hash)
        {
            return BCryptNet.Verify(password, hash);
        }
    }
}