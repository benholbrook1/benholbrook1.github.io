(function () {
  var CANVAS_SIZE = 280;
  var BRUSH_RADIUS = 12;
  var model = null;

  var drawCanvas = document.getElementById("draw-canvas");
  var previewCanvas = document.getElementById("preview-canvas");
  var predictBtn = document.getElementById("predict-btn");
  var clearBtn = document.getElementById("clear-btn");
  var statusEl = document.getElementById("model-status");
  var digitEl = document.getElementById("prediction-digit");
  var confidenceEl = document.getElementById("prediction-confidence");
  var confidenceRows = Array.prototype.slice.call(document.querySelectorAll(".confidence-row"));

  if (!drawCanvas || !previewCanvas) {
    return;
  }

  var drawCtx = drawCanvas.getContext("2d");
  var previewCtx = previewCanvas.getContext("2d");
  var drawing = false;

  drawCanvas.width = CANVAS_SIZE;
  drawCanvas.height = CANVAS_SIZE;
  previewCanvas.width = 28;
  previewCanvas.height = 28;

  function setStatus(text, className) {
    if (!text) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.className = "model-status";
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = text;
    statusEl.className = "model-status" + (className ? " " + className : "");
  }

  function clearCanvas() {
    drawCtx.fillStyle = "#000";
    drawCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    resetPrediction();
  }

  function resetPrediction() {
    digitEl.textContent = "–";
    confidenceEl.textContent = "Draw a digit, then predict";
    confidenceRows.forEach(function (row) {
      row.classList.remove("is-top");
      row.querySelector(".confidence-bar span").style.width = "0%";
      row.querySelector(".confidence-value").textContent = "0.0%";
    });
    previewCtx.fillStyle = "#000";
    previewCtx.fillRect(0, 0, 28, 28);
  }

  function drawPoint(x, y) {
    drawCtx.fillStyle = "#fff";
    drawCtx.beginPath();
    drawCtx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2);
    drawCtx.fill();
  }

  function getCanvasPoint(event) {
    var rect = drawCanvas.getBoundingClientRect();
    var scaleX = drawCanvas.width / rect.width;
    var scaleY = drawCanvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function preprocessCanvas() {
    var imageData = drawCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    var data = imageData.data;
    var minX = CANVAS_SIZE;
    var minY = CANVAS_SIZE;
    var maxX = 0;
    var maxY = 0;
    var found = false;

    for (var y = 0; y < CANVAS_SIZE; y++) {
      for (var x = 0; x < CANVAS_SIZE; x++) {
        var value = data[(y * CANVAS_SIZE + x) * 4];
        if (value > 10) {
          found = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    previewCtx.fillStyle = "#000";
    previewCtx.fillRect(0, 0, 28, 28);

    if (!found) {
      return new Float32Array(28 * 28);
    }

    var cropWidth = maxX - minX + 1;
    var cropHeight = maxY - minY + 1;
    var cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropWidth;
    cropCanvas.height = cropHeight;
    cropCanvas.getContext("2d").drawImage(drawCanvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    var scale = 20 / Math.max(cropWidth, cropHeight);
    var resizedWidth = Math.max(1, Math.round(cropWidth * scale));
    var resizedHeight = Math.max(1, Math.round(cropHeight * scale));
    var resizedCanvas = document.createElement("canvas");
    resizedCanvas.width = resizedWidth;
    resizedCanvas.height = resizedHeight;
    resizedCanvas.getContext("2d").drawImage(cropCanvas, 0, 0, resizedWidth, resizedHeight);

    var startX = Math.floor((28 - resizedWidth) / 2);
    var startY = Math.floor((28 - resizedHeight) / 2);
    previewCtx.drawImage(resizedCanvas, startX, startY);

    var finalData = previewCtx.getImageData(0, 0, 28, 28).data;
    var tensorData = new Float32Array(28 * 28);

    for (var i = 0; i < 28 * 28; i++) {
      tensorData[i] = finalData[i * 4] / 255;
    }

    return tensorData;
  }

  function updateConfidenceBars(probabilities, predictedDigit) {
    probabilities.forEach(function (prob, digit) {
      var row = confidenceRows[digit];
      var percent = prob * 100;
      row.classList.toggle("is-top", digit === predictedDigit);
      row.querySelector(".confidence-bar span").style.width = percent.toFixed(1) + "%";
      row.querySelector(".confidence-value").textContent = percent.toFixed(1) + "%";
    });
  }

  async function predictDigit() {
    if (!model) {
      setStatus("Model is still loading…", "");
      return;
    }

    predictBtn.disabled = true;
    var tensorData = preprocessCanvas();
    var input = tf.tensor4d(Array.from(tensorData), [1, 28, 28, 1]);
    var logits = model.predict(input);
    var probabilities = tf.softmax(logits).dataSync();
    var predictedDigit = 0;

    for (var i = 1; i < probabilities.length; i++) {
      if (probabilities[i] > probabilities[predictedDigit]) {
        predictedDigit = i;
      }
    }

    digitEl.textContent = String(predictedDigit);
    confidenceEl.innerHTML = "Confidence: <strong>" + (probabilities[predictedDigit] * 100).toFixed(1) + "%</strong>";
    updateConfidenceBars(probabilities, predictedDigit);

    input.dispose();
    logits.dispose();
    predictBtn.disabled = false;
  }

  async function loadModel() {
    try {
      setStatus("Loading model…", "");
      model = await tf.loadLayersModel("models/number-recognition/model.json");
      setStatus("");
      predictBtn.disabled = false;
    } catch (error) {
      console.error(error);
      setStatus("Could not load model", "is-error");
    }
  }

  drawCanvas.addEventListener("pointerdown", function (event) {
    drawing = true;
    drawCanvas.setPointerCapture(event.pointerId);
    var point = getCanvasPoint(event);
    drawPoint(point.x, point.y);
  });

  drawCanvas.addEventListener("pointermove", function (event) {
    if (!drawing) {
      return;
    }
    var point = getCanvasPoint(event);
    drawPoint(point.x, point.y);
  });

  function stopDrawing(event) {
    if (!drawing) {
      return;
    }
    drawing = false;
    if (drawCanvas.hasPointerCapture(event.pointerId)) {
      drawCanvas.releasePointerCapture(event.pointerId);
    }
  }

  drawCanvas.addEventListener("pointerup", stopDrawing);
  drawCanvas.addEventListener("pointerleave", stopDrawing);
  drawCanvas.addEventListener("pointercancel", stopDrawing);

  clearBtn.addEventListener("click", clearCanvas);
  predictBtn.addEventListener("click", predictDigit);
  predictBtn.disabled = true;

  clearCanvas();
  loadModel();
})();
