document.addEventListener('DOMContentLoaded', function() {
    var imageContainers = document.querySelectorAll('.image-container');
    var text = document.querySelector('.text-overlay');
    var currentIndex = 0;
  
    function showImage(index) {
      var img = imageContainers[currentIndex];
      var nomeImagem = extractFileName(img.querySelector('img').src);

      text.textContent = nomeImagem;
      imageContainers[currentIndex].style.opacity = 0;
      currentIndex = index;
      imageContainers[currentIndex].style.opacity = 1;
    }
  
    function nextImage() {
      var newIndex = (currentIndex + 1) % imageContainers.length;
      showImage(newIndex);
    }
  
    function prevImage() {
      var newIndex = (currentIndex - 1 + imageContainers.length) % imageContainers.length;
      showImage(newIndex);
    }
  
    document.getElementById('nextBtn').addEventListener('click', nextImage);
    document.getElementById('prevBtn').addEventListener('click', prevImage);
  
    showImage(currentIndex);
  });

  function extractFileName(url) {
    var index = url.lastIndexOf("/") + 1;
    var filenameWithExtension = url.substr(index);
    var filename = filenameWithExtension.split(".")[0];
    return filename;
  }