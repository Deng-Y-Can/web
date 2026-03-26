using CandyNote.Models;
using CandyNote.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CandyNote.Controllers
{
    [Authorize]
    public class HomeController : Controller
    {
        private readonly ICollectionService _collectionService;
        private readonly INoteService _noteService;

        public HomeController(ICollectionService collectionService, INoteService noteService)
        {
            _collectionService = collectionService;
            _noteService = noteService;
        }

        public async Task<IActionResult> Index(int? collectionId)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var isAdmin = User.IsInRole("Admin");

            var notes = await _noteService.GetNotesByCollectionAsync(collectionId, userId, isAdmin);

            return View(notes);
        }

        [HttpGet]
        public async Task<IActionResult> Search(string keyword)
        {
            if (string.IsNullOrWhiteSpace(keyword))
            {
                return RedirectToAction("Index");
            }

            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var isAdmin = User.IsInRole("Admin");

            var results = await _noteService.SearchNotesAsync(keyword, userId, isAdmin);
            ViewBag.Keyword = keyword;

            return View(results);
        }
    }
}