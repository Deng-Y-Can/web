using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CandyRepository.Models
{
    public enum DeletedItemType
    {
        File,
        Folder
    }

    public class RecycleBin
    {
        [Key]
        public int Id { get; set; }

        public DeletedItemType ItemType { get; set; }

        public int ItemId { get; set; }

        public string OriginalPath { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public int DeletedByUserId { get; set; }

        public DateTime DeletedAt { get; set; } = DateTime.UtcNow;

        public DateTime ExpiresAt { get; set; }

        // Navigation properties
        [ForeignKey("DeletedByUserId")]
        public virtual User? DeletedBy { get; set; }
    }
}