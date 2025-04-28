if (!window.myAPI) {
    console.error('[Renderer] window.myAPI is not available!');
  }
  
window.addEventListener('DOMContentLoaded', () => {
    window.myAPI.onThumbnail((base64Thumb) => {
      document.getElementById('thumbnail').src = 'data:image/png;base64,' + base64Thumb;
    });
  });
  