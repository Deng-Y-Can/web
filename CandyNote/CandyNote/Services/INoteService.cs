using CandyNote.Models;

namespace CandyNote.Services
{
    public interface INoteService
    {
        Task<Note> CreateNoteAsync(Note note);
        Task<bool> UpdateNoteAsync(Note note);
        Task<bool> DeleteNoteAsync(int noteId);
        Task<Note?> GetNoteByIdAsync(int noteId);
        Task<List<Note>> GetNotesByCollectionAsync(int? collectionId, int userId, bool isAdmin);
        Task<bool> ChangeNotePermissionAsync(int noteId, NotePermission newPermission);
        Task<List<Note>> SearchNotesAsync(string keyword, int userId, bool isAdmin);
        Task<(int successCount, int failCount)> BatchDeleteNotesAsync(List<int> noteIds, int userId, bool isAdmin);
        Task<Note?> DuplicateNoteAsync(int sourceNoteId, int newUserId);
        Task<bool> MoveNoteToCollectionAsync(int noteId, int? collectionId, int userId, bool isAdmin);
        Task<object> GetNoteStatsAsync(int userId, bool isAdmin);
        Task<string> ExportToMarkdownAsync(int noteId);
    }
}