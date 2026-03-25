using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CandyRepository.Models
{
    public enum FolderType
    {
        Private,
        Public
    }

    public class Folder
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(255)]
        public string Name { get; set; } = string.Empty;

        [Required]
        public FolderType Type { get; set; }

        public string? Path { get; set; }

        public int? ParentFolderId { get; set; }

        [Required]
        public int OwnerId { get; set; }

        public string? FullPath { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? ModifiedAt { get; set; }

        public bool IsDeleted { get; set; } = false;

        // Navigation properties
        [ForeignKey("ParentFolderId")]
        public virtual Folder? ParentFolder { get; set; }

        [ForeignKey("OwnerId")]
        public virtual User? Owner { get; set; }

        public virtual ICollection<Folder> SubFolders { get; set; } = new List<Folder>();

        public virtual ICollection<Models.File> Files { get; set; } = new List<Models.File>();

        public virtual ICollection<FolderPermission> Permissions { get; set; } = new List<FolderPermission>();
    }
}