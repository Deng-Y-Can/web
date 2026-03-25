using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CandyRepository.Models
{
    public enum OperationType
    {
        Login,
        Logout,
        FileUpload,
        FileDownload,
        FileDelete,
        FileRestore,
        FileRename,
        FileMove,
        FolderCreate,
        FolderDelete,
        FolderRename,
        FolderMove,
        PermissionChange,
        UserCreate,
        UserUpdate,
        UserDelete
    }

    public class OperationLog
    {
        [Key]
        public int Id { get; set; }

        public int UserId { get; set; }

        public OperationType OperationType { get; set; }

        public string? TargetPath { get; set; }

        public string? Details { get; set; }

        public string? IPAddress { get; set; }

        public string? UserAgent { get; set; }

        public DateTime OperationTime { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}