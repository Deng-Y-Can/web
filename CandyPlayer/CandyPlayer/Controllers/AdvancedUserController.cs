using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using CandyPlayer.Services;
using CandyPlayer.Models;
using CandyPlayer.Data;
using Microsoft.AspNetCore.Mvc.Formatters;
using MediaType = CandyPlayer.Models.MediaType;

namespace CandyPlayer.Controllers
{
    [Authorize]
    public class AdvancedUserController : Controller
    {
        private readonly MediaService _mediaService;

        public AdvancedUserController(MediaService mediaService)
        {
            _mediaService = mediaService;
        }

        public async Task<IActionResult> Index()
        {
            var stats = await _mediaService.GetFileStatisticsAsync();
            var topFiles = await _mediaService.GetTopPlayedFilesAsync(10);

            ViewBag.TotalFiles = stats.Values.Sum();
            ViewBag.BookCount = stats[MediaType.Book];
            ViewBag.MusicCount = stats[MediaType.Music];
            ViewBag.VideoCount = stats[MediaType.Video];
            ViewBag.TopFiles = topFiles;

            return View();
        }
    }


}