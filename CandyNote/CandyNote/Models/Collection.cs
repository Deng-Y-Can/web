using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace CandyNote.Models
{
    public enum CollectionPermission
    {
        Private,  // 私有：只有创建者和管理员可见
        Public    // 公开：所有用户可见
    }

    public class Collection
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }  // 合集简介

        public CollectionPermission Permission { get; set; } = CollectionPermission.Private;  // 默认私有

        public int? ParentCollectionId { get; set; }

        [ForeignKey("ParentCollectionId")]
        [JsonIgnore]
        public virtual Collection? ParentCollection { get; set; }

        public int CreatorId { get; set; }

        [ForeignKey("CreatorId")]
        [JsonIgnore]
        public virtual User Creator { get; set; } = null!;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }  // 最后更新时间

        [JsonIgnore]
        public virtual ICollection<Collection> SubCollections { get; set; } = new List<Collection>();

        [JsonIgnore]
        public virtual ICollection<Note> Notes { get; set; } = new List<Note>();
    }
}