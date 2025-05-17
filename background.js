// Default problem URLs - can be modified by the user
let problemUrls = [];
let extractedProblems = [];
let currentIndex = 0;
let isAutoRotating = false;
let rotationInterval = 15000; // 15 seconds by default
let autoExtract = true;

// Initialize storage
chrome.storage.local.get(
  ["problemUrls", "rotationInterval", "autoExtract"],
  function (result) {
    if (result.problemUrls) problemUrls = result.problemUrls;
    if (result.rotationInterval) rotationInterval = result.rotationInterval;
    if (result.autoExtract !== undefined) autoExtract = result.autoExtract;
  }
);

// Function to navigate to the next problem
function goToNextProblem() {
  if (problemUrls.length === 0 || !isAutoRotating) return;

  currentIndex = (currentIndex + 1) % problemUrls.length;
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { url: problemUrls[currentIndex] });
    }
  });
}

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startRotation") {
    isAutoRotating = true;

    // Store the problem URLs if provided
    if (message.problemUrls) {
      problemUrls = message.problemUrls;
      chrome.storage.local.set({ problemUrls });
      currentIndex = 0;
    }

    // Store rotation interval if provided
    if (message.rotationInterval) {
      rotationInterval = message.rotationInterval * 1000; // Convert to milliseconds
      chrome.storage.local.set({ rotationInterval: message.rotationInterval });
    }

    // Store auto-extract setting if provided
    if (message.autoExtract !== undefined) {
      autoExtract = message.autoExtract;
      chrome.storage.local.set({ autoExtract });
    }

    // Navigate to the first problem
    if (problemUrls.length > 0) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs.length > 0) {
          chrome.tabs.update(tabs[0].id, { url: problemUrls[currentIndex] });
        }
      });
    }

    sendResponse({
      status: "rotation started",
      currentUrl: problemUrls[currentIndex],
    });
  } else if (message.action === "stopRotation") {
    isAutoRotating = false;
    sendResponse({ status: "rotation stopped" });
  } else if (message.action === "getStatus") {
    sendResponse({
      isAutoRotating,
      currentIndex,
      problemUrls,
      rotationInterval: rotationInterval / 1000,
      autoExtract,
      extractedProblems,
    });
  } else if (message.action === "problemExtracted") {
    // Store the extracted problem
    extractedProblems.push(message.problem);

    // If we're auto-rotating, schedule the next problem
    if (isAutoRotating) {
      setTimeout(goToNextProblem, rotationInterval);
    }
    sendResponse({ status: "received" });
  } else if (message.action === "downloadAllProblems") {
    // Create a download for all extracted problems
    if (extractedProblems.length > 0) {
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(extractedProblems, null, 2));

      chrome.tabs.create(
        {
          url: dataStr,
          active: false,
        },
        function (tab) {
          chrome.downloads.download(
            {
              url: dataStr,
              filename: "codeforces_problems.json",
              saveAs: true,
            },
            function () {
              setTimeout(function () {
                chrome.tabs.remove(tab.id);
              }, 500);
            }
          );
        }
      );
    }
    sendResponse({
      status: "download initiated",
      count: extractedProblems.length,
    });
  } else if (message.action === "clearExtractedProblems") {
    extractedProblems = [];
    sendResponse({ status: "cleared" });
  }

  return true; // Keep the message channel open for async responses
});

// Listen for tab updates to handle extraction on page load
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    // Check if this is a Codeforces problem page
    if (
      tab.url &&
      (tab.url.includes("codeforces.com/problemset/problem") ||
        (tab.url.includes("codeforces.com/contest") &&
          tab.url.includes("/problem/")))
    ) {
      // If auto-extract is enabled, send message to content script to extract the problem
      if (isAutoRotating && autoExtract) {
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: "extractOnLoad" });
        }, 2000); // Wait 2 seconds for page to fully render
      }
    }
  }
});
