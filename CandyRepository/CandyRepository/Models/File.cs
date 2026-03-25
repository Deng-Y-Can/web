using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CandyRepository.Models
{
    public class File
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(255)]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string PhysicalPath { get; set; } = string.Empty;

        public long Size { get; set; }

        public string? ContentType { get; set; }

        public string? FileHash { get; set; }

        public int FolderId { get; set; }

        public int UploadedById { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        public DateTime? ModifiedAt { get; set; }

        public bool IsDeleted { get; set; } = false;

        // Navigation properties
        [ForeignKey("FolderId")]
        public virtual Folder? Folder { get; set; }

        [ForeignKey("UploadedById")]
        public virtual User? UploadedBy { get; set; }

        public virtual ICollection<FilePermission> Permissions { get; set; } = new List<FilePermission>();
    }
}