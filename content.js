// Add a button to the page
function addExtractButton() {
  // Check if we're on a problem page
  if (!document.querySelector('.problem-statement')) {
    return;
  }
  
  // Check if button already exists
  if (document.querySelector('.cf-extractor-container')) {
    return;
  }
  
  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'cf-extractor-container';
  
  // Create extract button
  const extractButton = document.createElement('button');
  extractButton.textContent = 'Extract Problem';
  extractButton.className = 'cf-extractor-button';
  extractButton.addEventListener('click', () => extractProblem(true)); // true = manual extraction
  
  // Add status indicator
  const statusIndicator = document.createElement('div');
  statusIndicator.className = 'cf-extractor-status';
  statusIndicator.id = 'cf-extractor-status';
  
  // Add button and status to container
  buttonContainer.appendChild(extractButton);
  buttonContainer.appendChild(statusIndicator);
  
  // Add container to page (right after the problem title)
  const titleElement = document.querySelector('.problem-statement .title');
  if (titleElement) {
    titleElement.parentNode.insertBefore(buttonContainer, titleElement.nextSibling);
  } else {
    // Fallback - add to top of problem statement
    const problemStatement = document.querySelector('.problem-statement');
    if (problemStatement) {
      problemStatement.insertBefore(buttonContainer, problemStatement.firstChild);
    }
  }
}

function extractProblem(isManualExtraction = false) {
  const problemStatement = document.querySelector('.problem-statement');
  if (!problemStatement) {
    showStatus('No problem statement found', 'error');
    return null;
  }

  try {
    // Extract problem title
    const titleElement = problemStatement.querySelector('.title');
    const title = titleElement ? titleElement.textContent.trim() : 'Unknown Title';
    
    // Extract time and memory limits
    const timeLimitElement = problemStatement.querySelector('.time-limit');
    const timeLimit = timeLimitElement ? timeLimitElement.textContent.replace('time limit per test', '').trim() : 'Unknown';
    
    const memoryLimitElement = problemStatement.querySelector('.memory-limit');
    const memoryLimit = memoryLimitElement ? memoryLimitElement.textContent.replace('memory limit per test', '').trim() : 'Unknown';
    
    // Extract problem description
    const headerElement = problemStatement.querySelector('.header');
    let descriptionElement = headerElement ? headerElement.nextElementSibling : null;
    let description = '';
    
    while (descriptionElement && !descriptionElement.classList.contains('input-specification')) {
      if (descriptionElement.textContent) {
        description += descriptionElement.textContent.trim() + '\n';
      }
      descriptionElement = descriptionElement.nextElementSibling;
    }
    
    // Extract input specification
    const inputSpecElement = problemStatement.querySelector('.input-specification');
    const inputSpec = inputSpecElement ? 
      Array.from(inputSpecElement.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .join('\n') : 'Not specified';
    
    // Extract output specification
    const outputSpecElement = problemStatement.querySelector('.output-specification');
    const outputSpec = outputSpecElement ? 
      Array.from(outputSpecElement.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .join('\n') : 'Not specified';
    
    // Extract sample tests
    const samples = [];
    const inputElements = document.querySelectorAll('.sample-test .input');
    const outputElements = document.querySelectorAll('.sample-test .output');
    
    for (let i = 0; i < Math.min(inputElements.length, outputElements.length); i++) {
      const inputPre = inputElements[i].querySelector('pre');
      const outputPre = outputElements[i].querySelector('pre');
      
      if (inputPre && outputPre) {
        samples.push({
          input: inputPre.textContent.trim(),
          output: outputPre.textContent.trim()
        });
      }
    }
    
    // Extract problem ID from URL
    const url = window.location.href;
    const problemIdMatch = url.match(/\/([0-9]+\/[A-Z][0-9]*)$/);
    const problemId = problemIdMatch ? problemIdMatch[1] : 'Unknown';
    
    // Extract tags if available
    const tagsElements = document.querySelectorAll('.tag-box');
    const tags = Array.from(tagsElements).map(tag => tag.textContent.trim());
    
    // Create the problem object
    const problem = {
      id: problemId,
      url: url,
      title: title,
      timeLimit: timeLimit,
      memoryLimit: memoryLimit,
      description: description.trim(),
      inputSpecification: inputSpec,
      outputSpecification: outputSpec,
      samples: samples,
      tags: tags,
      extractedAt: new Date().toISOString()
    };
    
    // Send the problem to the background script
    chrome.runtime.sendMessage(
      { action: "problemExtracted", problem: problem },
      function(response) {
        if (response && response.status === "received") {
          showStatus('Problem extracted successfully!', 'success');
        }
      }
    );
    
    // If this is a manual extraction, also download the file
    if (isManualExtraction) {
      // Generate a download for the JSON file
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(problem, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `codeforces_problem_${problemId.replace('/', '_')}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    }
    
    return problem;
    
  } catch (error) {
    console.error('Error extracting problem:', error);
    showStatus('Error extracting problem', 'error');
    return null;
  }
}

function showStatus(message, type = 'info') {
  const statusElement = document.getElementById('cf-extractor-status');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `cf-extractor-status cf-extractor-${type}`;
    
    // Clear the status after 3 seconds
    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = 'cf-extractor-status';
    }, 3000);
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractOnLoad") {
    // Wait a bit to ensure the page is fully loaded
    setTimeout(() => {
      extractProblem(false); // false = automatic extraction
    }, 1000);
    sendResponse({ status: "extraction initiated" });
  }
  return true;
});

// Run when page loads
window.addEventListener('load', addExtractButton);