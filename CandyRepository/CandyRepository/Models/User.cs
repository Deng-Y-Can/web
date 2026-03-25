using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CandyRepository.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        public string Salt { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public bool IsAdmin { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastLoginAt { get; set; }

        public string? LastLoginIP { get; set; }

        // Navigation properties
        public virtual ICollection<Folder> OwnedFolders { get; set; } = new List<Folder>();
        public virtual ICollection<FolderPermission> FolderPermissions { get; set; } = new List<FolderPermission>();
        public virtual ICollection<FilePermission> FilePermissions { get; set; } = new List<FilePermission>();
        public virtual ICollection<OperationLog> OperationLogs { get; set; } = new List<OperationLog>();
    }
}