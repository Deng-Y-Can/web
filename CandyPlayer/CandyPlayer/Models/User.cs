using System.ComponentModel.DataAnnotations;

namespace CandyPlayer.Models
{
    public enum UserRole
    {
        NormalUser = 0,
        AdvancedUser = 1,
        Admin = 2
    }

    public class User
    {
        [Key]
        public int UserId { get; set; }

        [Required]
        [StringLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [StringLength(255)]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        public UserRole Role { get; set; } = UserRole.NormalUser;

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public DateTime? LastLoginTime { get; set; }

        // 导航属性
        public virtual ICollection<Playlist> Playlists { get; set; } = new List<Playlist>();
        public virtual ICollection<Favorite> Favorites { get; set; } = new List<Favorite>();
        public virtual ICollection<PlayHistory> PlayHistories { get; set; } = new List<PlayHistory>();
    }
}