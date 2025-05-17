document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const problemUrlsTextarea = document.getElementById('problem-urls');
  const rotationIntervalInput = document.getElementById('rotation-interval');
  const autoExtractCheckbox = document.getElementById('auto-extract');
  const startRotationButton = document.getElementById('start-rotation');
  const stopRotationButton = document.getElementById('stop-rotation');
  const rotationStatusDiv = document.getElementById('rotation-status');
  const extractedCountSpan = document.getElementById('extracted-count');
  const downloadAllButton = document.getElementById('download-all');
  const clearAllButton = document.getElementById('clear-all');
  
  // Load saved settings
  chrome.storage.local.get(['problemUrls', 'rotationInterval', 'autoExtract'], function(result) {
    if (result.problemUrls) {
      problemUrlsTextarea.value = result.problemUrls.join('\n');
    }
    if (result.rotationInterval) {
      rotationIntervalInput.value = result.rotationInterval;
    }
    if (result.autoExtract !== undefined) {
      autoExtractCheckbox.checked = result.autoExtract;
    }
  });
  
  // Get current status from background script
  updateStatus();
  
  // Set up event listeners
  startRotationButton.addEventListener('click', startRotation);
  stopRotationButton.addEventListener('click', stopRotation);
  downloadAllButton.addEventListener('click', downloadAllProblems);
  clearAllButton.addEventListener('click', clearAllProblems);
  
  function startRotation() {
    // Parse problem URLs
    const urls = problemUrlsTextarea.value.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    if (urls.length === 0) {
      showStatus('Please enter at least one problem URL', 'error');
      return;
    }
    
    // Get rotation interval
    const interval = parseInt(rotationIntervalInput.value);
    if (isNaN(interval) || interval < 5) {
      showStatus('Interval must be at least 5 seconds', 'error');
      return;
    }
    
    // Get auto-extract setting
    const autoExtract = autoExtractCheckbox.checked;
    
    // Send message to background script
    chrome.runtime.sendMessage({
      action: "startRotation",
      problemUrls: urls,
      rotationInterval: interval,
      autoExtract: autoExtract
    }, function(response) {
      if (response && response.status === "rotation started") {
        showStatus(`Rotation started with ${urls.length} problems. Interval: ${interval}s`, 'success');
        updateStatus();
      }
    });
  }
  
  function stopRotation() {
    chrome.runtime.sendMessage({ action: "stopRotation" }, function(response) {
      if (response && response.status === "rotation stopped") {
        showStatus('Rotation stopped', 'info');
        updateStatus();
      }
    });
  }
  
  function downloadAllProblems() {
    chrome.runtime.sendMessage({ action: "downloadAllProblems" }, function(response) {
      if (response) {
        if (response.count > 0) {
          showStatus(`Downloading ${response.count} problems...`, 'success');
        } else {
          showStatus('No problems to download', 'error');
        }
      }
    });
  }
  
  function clearAllProblems() {
    if (confirm('Are you sure you want to clear all extracted problems?')) {
      chrome.runtime.sendMessage({ action: "clearExtractedProblems" }, function(response) {
        if (response && response.status === "cleared") {
          showStatus('All extracted problems cleared', 'info');
          updateStatus();
        }
      });
    }
  }
  
  function updateStatus() {
    chrome.runtime.sendMessage({ action: "getStatus" }, function(response) {
      if (response) {
        // Update extracted count
        extractedCountSpan.textContent = response.extractedProblems.length;
        
        // Update rotation status
        if (response.isAutoRotating) {
          rotationStatusDiv.style.display = 'block';
          rotationStatusDiv.textContent = `Rotation active: Problem ${response.currentIndex + 1}/${response.problemUrls.length}`;
          rotationStatusDiv.className = 'status success';
        } else {
          rotationStatusDiv.style.display = 'none';
        }
      }
    });
  }
  
  function showStatus(message, type = 'info') {
    rotationStatusDiv.textContent = message;
    rotationStatusDiv.className = `status ${type}`;
    rotationStatusDiv.style.display = 'block';
  }
  
  // Update status every 2 seconds
  setInterval(updateStatus, 2000);
});
