using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CandyRepository.Models
{
    public enum PermissionType
    {
        NoPermission = 0,
        ViewOnly = 1,
        CanDownload = 2,
        CanEdit = 3,
        FullControl = 4
    }

    public class FolderPermission
    {
        [Key]
        public int Id { get; set; }

        public int FolderId { get; set; }

        public int UserId { get; set; }

        public PermissionType Permission { get; set; }

        public bool IsInherited { get; set; } = false;

        public DateTime GrantedAt { get; set; } = DateTime.UtcNow;

        public int GrantedById { get; set; }

        // Navigation properties
        [ForeignKey("FolderId")]
        public virtual Folder? Folder { get; set; }

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }

        [ForeignKey("GrantedById")]
        public virtual User? GrantedBy { get; set; }
    }

    public class FilePermission
    {
        [Key]
        public int Id { get; set; }

        public int FileId { get; set; }

        public int UserId { get; set; }

        public PermissionType Permission { get; set; }

        public bool IsInherited { get; set; } = true;

        public DateTime GrantedAt { get; set; } = DateTime.UtcNow;

        public int GrantedById { get; set; }

        // Navigation properties
        [ForeignKey("FileId")]
        public virtual Models.File? File { get; set; }

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }

        [ForeignKey("GrantedById")]
        public virtual User? GrantedBy { get; set; }
    }
}