using Microsoft.EntityFrameworkCore;
using CandyRepository.Models;

namespace CandyRepository.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Folder> Folders { get; set; }
        public DbSet<Models.File> Files { get; set; }
        public DbSet<FolderPermission> FolderPermissions { get; set; }
        public DbSet<FilePermission> FilePermissions { get; set; }
        public DbSet<OperationLog> OperationLogs { get; set; }
        public DbSet<RecycleBin> RecycleBin { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 设置复合唯一索引
            modelBuilder.Entity<FolderPermission>()
                .HasIndex(fp => new { fp.FolderId, fp.UserId })
                .IsUnique();

            modelBuilder.Entity<FilePermission>()
                .HasIndex(fp => new { fp.FileId, fp.UserId })
                .IsUnique();

            // 设置默认值
            modelBuilder.Entity<User>()
                .Property(u => u.IsActive)
                .HasDefaultValue(true);

            modelBuilder.Entity<User>()
                .Property(u => u.IsAdmin)
                .HasDefaultValue(false);

            // 设置软删除过滤
            modelBuilder.Entity<Folder>()
                .HasQueryFilter(f => !f.IsDeleted);

            modelBuilder.Entity<Models.File>()
                .HasQueryFilter(f => !f.IsDeleted);

            // 设置级联删除行为
            modelBuilder.Entity<Folder>()
                .HasOne(f => f.ParentFolder)
                .WithMany(f => f.SubFolders)
                .HasForeignKey(f => f.ParentFolderId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<FolderPermission>()
                .HasOne(fp => fp.Folder)
                .WithMany(f => f.Permissions)
                .HasForeignKey(fp => fp.FolderId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<FolderPermission>()
                .HasOne(fp => fp.User)
                .WithMany(u => u.FolderPermissions)
                .HasForeignKey(fp => fp.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<FolderPermission>()
                .HasOne(fp => fp.GrantedBy)
                .WithMany()
                .HasForeignKey(fp => fp.GrantedById)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<FilePermission>()
                .HasOne(fp => fp.File)
                .WithMany(f => f.Permissions)
                .HasForeignKey(fp => fp.FileId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<FilePermission>()
                .HasOne(fp => fp.User)
                .WithMany(u => u.FilePermissions)
                .HasForeignKey(fp => fp.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<FilePermission>()
                .HasOne(fp => fp.GrantedBy)
                .WithMany()
                .HasForeignKey(fp => fp.GrantedById)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<OperationLog>()
                .HasOne(l => l.User)
                .WithMany(u => u.OperationLogs)
                .HasForeignKey(l => l.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<RecycleBin>()
                .HasOne(r => r.DeletedBy)
                .WithMany()
                .HasForeignKey(r => r.DeletedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}