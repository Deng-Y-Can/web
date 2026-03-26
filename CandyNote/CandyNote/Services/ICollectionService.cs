using CandyNote.Models;

namespace CandyNote.Services
{
    public interface ICollectionService
    {
        Task<Collection> CreateCollectionAsync(Collection collection);
        Task<bool> UpdateCollectionAsync(Collection collection);
        Task<bool> DeleteCollectionAsync(int collectionId);
        Task<Collection?> GetCollectionByIdAsync(int collectionId);
        Task<List<Collection>> GetUserCollectionsAsync(int userId);
        Task<List<Collection>> GetRootCollectionsAsync();
        Task<bool> MoveCollectionAsync(int collectionId, int? newParentId);
        Task<List<object>> GetCollectionTreeAsync(int? parentId, int userId, bool isAdmin);
        Task<bool> ChangeCollectionPermissionAsync(int collectionId, CollectionPermission newPermission);
        Task<List<Collection>> GetPublicCollectionsAsync();
        Task<List<Collection>> SearchCollectionsAsync(string keyword, int userId, bool isAdmin);
    }
}