using CandyNote.Data;
using CandyNote.Models;
using Microsoft.EntityFrameworkCore;

namespace CandyNote.Services
{
    public class CollectionService : ICollectionService
    {
        private readonly ApplicationDbContext _context;

        public CollectionService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Collection> CreateCollectionAsync(Collection collection)
        {
            collection.CreatedAt = DateTime.UtcNow;
            collection.UpdatedAt = DateTime.UtcNow;
            _context.Collections.Add(collection);
            await _context.SaveChangesAsync();
            return collection;
        }

        public async Task<bool> UpdateCollectionAsync(Collection collection)
        {
            var existing = await _context.Collections.FindAsync(collection.Id);
            if (existing == null)
                return false;

            existing.Name = collection.Name;
            existing.Description = collection.Description;
            existing.Permission = collection.Permission;
            existing.ParentCollectionId = collection.ParentCollectionId;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteCollectionAsync(int collectionId)
        {
            var collection = await _context.Collections
                .Include(c => c.SubCollections)
                .Include(c => c.Notes)
                .FirstOrDefaultAsync(c => c.Id == collectionId);

            if (collection == null)
                return false;

            foreach (var subCollection in collection.SubCollections)
            {
                subCollection.ParentCollectionId = null;
            }

            foreach (var note in collection.Notes)
            {
                note.CollectionId = null;
            }

            _context.Collections.Remove(collection);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<Collection?> GetCollectionByIdAsync(int collectionId)
        {
            return await _context.Collections
                .Include(c => c.Creator)
                .FirstOrDefaultAsync(c => c.Id == collectionId);
        }

        public async Task<List<Collection>> GetUserCollectionsAsync(int userId)
        {
            return await _context.Collections
                .Where(c => c.CreatorId == userId)
                .OrderBy(c => c.Name)
                .ToListAsync();
        }

        public async Task<List<Collection>> GetRootCollectionsAsync()
        {
            return await _context.Collections
                .Where(c => c.ParentCollectionId == null)
                .OrderBy(c => c.Name)
                .ToListAsync();
        }

        public async Task<List<Collection>> GetPublicCollectionsAsync()
        {
            return await _context.Collections
                .Where(c => c.Permission == CollectionPermission.Public)
                .OrderBy(c => c.Name)
                .ToListAsync();
        }

        public async Task<bool> MoveCollectionAsync(int collectionId, int? newParentId)
        {
            var collection = await _context.Collections.FindAsync(collectionId);
            if (collection == null)
                return false;

            if (newParentId.HasValue)
            {
                var parent = await _context.Collections.FindAsync(newParentId.Value);
                while (parent != null)
                {
                    if (parent.Id == collectionId)
                        return false;
                    parent = await _context.Collections.FindAsync(parent.ParentCollectionId);
                }
            }

            collection.ParentCollectionId = newParentId;
            collection.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> ChangeCollectionPermissionAsync(int collectionId, CollectionPermission newPermission)
        {
            var collection = await _context.Collections.FindAsync(collectionId);
            if (collection == null)
                return false;

            collection.Permission = newPermission;
            collection.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<Collection>> SearchCollectionsAsync(string keyword, int userId, bool isAdmin)
        {
            var query = _context.Collections
                .Include(c => c.Creator)
                .Where(c => c.Name.Contains(keyword) || (c.Description != null && c.Description.Contains(keyword)));

            if (!isAdmin)
            {
                query = query.Where(c =>
                    c.Permission == CollectionPermission.Public ||
                    c.CreatorId == userId);
            }

            return await query
                .OrderByDescending(c => c.UpdatedAt)
                .ToListAsync();
        }

        public async Task<List<object>> GetCollectionTreeAsync(int? parentId, int userId, bool isAdmin)
        {
            var tree = new List<object>();

            // 获取合集 - 根据权限过滤
            var collectionsQuery = _context.Collections
                .Where(c => c.ParentCollectionId == parentId);

            if (!isAdmin)
            {
                collectionsQuery = collectionsQuery.Where(c =>
                    c.Permission == CollectionPermission.Public ||
                    c.CreatorId == userId);
            }

            var collections = await collectionsQuery
                .OrderBy(c => c.Name)
                .Select(c => new { c.Id, c.Name, c.Description, c.Permission, c.CreatorId, c.CreatedAt, c.UpdatedAt })
                .ToListAsync();

            foreach (var collection in collections)
            {
                // 获取合集内的笔记 - 根据权限过滤
                var notesQuery = _context.Notes
                    .Where(n => n.CollectionId == collection.Id);

                if (!isAdmin)
                {
                    notesQuery = notesQuery.Where(n =>
                        n.Permission == NotePermission.Public ||
                        n.UserId == userId);
                }

                var notes = await notesQuery
                    .Select(n => new
                    {
                        type = "note",
                        id = n.Id,
                        title = n.Title,
                        permission = n.Permission.ToString(),
                        updatedAt = n.UpdatedAt
                    })
                    .ToListAsync();

                var children = await GetCollectionTreeAsync(collection.Id, userId, isAdmin);

                tree.Add(new
                {
                    type = "collection",
                    id = collection.Id,
                    name = collection.Name,
                    description = collection.Description,
                    permission = collection.Permission.ToString(),
                    creatorId = collection.CreatorId,
                    createdAt = collection.CreatedAt,
                    updatedAt = collection.UpdatedAt,
                    notes = notes,
                    children = children
                });
            }

            // 添加没有合集的笔记（根级笔记）
            if (parentId == null)
            {
                var rootNotesQuery = _context.Notes
                    .Where(n => n.CollectionId == null);

                if (!isAdmin)
                {
                    rootNotesQuery = rootNotesQuery.Where(n =>
                        n.Permission == NotePermission.Public ||
                        n.UserId == userId);
                }

                var rootNotes = await rootNotesQuery
                    .Select(n => new
                    {
                        type = "note",
                        id = n.Id,
                        title = n.Title,
                        permission = n.Permission.ToString(),
                        updatedAt = n.UpdatedAt
                    })
                    .ToListAsync();

                foreach (var note in rootNotes)
                {
                    tree.Add(note);
                }
            }

            return tree;
        }
    }
}