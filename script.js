// Activate Paper.js
paper.install(window);
window.onload = function() {
    // Setup Paper.js
    const canvas = document.getElementById('drawing-canvas');
    paper.setup(canvas);

    // ======================
    // Global Variables
    // ======================
    let currentTool = null;
    let selectedItem = null;
    let history = [];
    let historyIndex = -1;
    const gridSize = 50;
    let gridVisible = false;
    let handles = [];

    // DOM Elements
    const layersList = document.getElementById('layers-list');
    const gridOverlay = document.getElementById('grid-overlay');
    const propertiesPanel = document.getElementById('properties-panel');
    const codeModal = document.getElementById('code-modal');
    const closeCodeModal = document.getElementById('close-code-modal');
    const phaserCodePre = document.getElementById('phaser-code');
    const helpModal = document.getElementById('help-modal');
    const closeHelpModal = document.getElementById('close-help-modal');
    const fileInput = document.getElementById('file-input');

    // Initialize Layers
    let currentLayer = new Layer();
    currentLayer.name = `Layer ${project.layers.length}`;
    addLayerToUI(currentLayer, currentLayer.name);

    // ======================
    // History Management
    // ======================
    function saveHistory() {
        // Truncate any redo history
        history = history.slice(0, historyIndex + 1);
        // Save current state
        history.push(project.exportJSON());
        historyIndex++;
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            project.clear();
            project.importJSON(history[historyIndex]);
            paper.view.update();
            updateLayersUI();
            deselectItem();
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            project.clear();
            project.importJSON(history[historyIndex]);
            paper.view.update();
            updateLayersUI();
            deselectItem();
        }
    }

    // Initialize history
    saveHistory();

    // ======================
    // Tool Definitions
    // ======================
    const toolsObj = {
        select: new Tool(),
        line: new Tool(),
        curve: new Tool(),
        rectangle: new Tool(),
        circle: new Tool()
    };

    let tempPath = null; // Temporary path for drawing
    let isDrawing = false; // Drawing state

    // Select Tool
    toolsObj.select.onMouseDown = function(event) {
        const hitResult = project.hitTest(event.point, {
            fill: true,
            stroke: true,
            segments: true,
            tolerance: 5
        });
        if (hitResult && hitResult.item) {
            selectItem(hitResult.item);
        } else {
            deselectItem();
        }
    };

    // Line Tool
    toolsObj.line.onMouseDown = function(event) {
        if (!isDrawing) {
            // Start drawing a new line
            tempPath = new Path.Line({
                from: event.point,
                to: event.point,
                strokeColor: 'black',
                strokeWidth: 2,
                layer: project.activeLayer
            });
            isDrawing = true;
        } else {
            // Finalize the line
            tempPath.remove();
            const finalLine = new Path.Line({
                from: tempPath.firstSegment.point,
                to: event.point,
                strokeColor: 'black',
                strokeWidth: 2,
                layer: project.activeLayer,
                name: 'Line'
            });
            saveHistory();
            isDrawing = false;
            selectItem(finalLine);
        }
    };

    toolsObj.line.onMouseMove = function(event) {
        if (isDrawing && tempPath) {
            tempPath.lastSegment.point = event.point;
            paper.view.draw();
        }
    };

    toolsObj.line.onMouseUp = function(event) {
        // No action needed here
    };

    // Curve Tool
    toolsObj.curve.onMouseDown = function(event) {
        if (!isDrawing) {
            // Start drawing a new curve
            tempPath = new Path({
                strokeColor: 'black',
                strokeWidth: 2,
                layer: project.activeLayer,
                name: 'Curve'
            });
            tempPath.add(event.point);
            isDrawing = true;
        } else {
            // Finalize the curve
            tempPath.add(event.point);
            tempPath.smooth({ type: 'continuous' });
            saveHistory();
            isDrawing = false;
            selectItem(tempPath);
        }
    };

    toolsObj.curve.onMouseMove = function(event) {
        if (isDrawing && tempPath) {
            tempPath.lastSegment.point = event.point;
            paper.view.draw();
        }
    };

    toolsObj.curve.onMouseUp = function(event) {
        // No action needed here
    };

    // Rectangle Tool
    toolsObj.rectangle.onMouseDown = function(event) {
        tempPath = new Path.Rectangle({
            point: event.point,
            size: [1, 1],
            strokeColor: 'black',
            strokeWidth: 2,
            layer: project.activeLayer,
            name: 'Rectangle'
        });
        isDrawing = true;
    };

    toolsObj.rectangle.onMouseDrag = function(event) {
        if (isDrawing && tempPath) {
            const size = event.point.subtract(tempPath.position);
            tempPath.size = new Size(size.x, size.y);
            paper.view.draw();
        }
    };

    toolsObj.rectangle.onMouseUp = function(event) {
        if (isDrawing && tempPath) {
            saveHistory();
            isDrawing = false;
            selectItem(tempPath);
            tempPath = null;
        }
    };

    // Circle Tool
    toolsObj.circle.onMouseDown = function(event) {
        tempPath = new Path.Circle({
            center: event.point,
            radius: 1,
            strokeColor: 'black',
            strokeWidth: 2,
            layer: project.activeLayer,
            name: 'Circle'
        });
        isDrawing = true;
    };

    toolsObj.circle.onMouseDrag = function(event) {
        if (isDrawing && tempPath) {
            const radius = event.point.subtract(tempPath.position).length;
            tempPath.radius = radius;
            paper.view.draw();
        }
    };

    toolsObj.circle.onMouseUp = function(event) {
        if (isDrawing && tempPath) {
            saveHistory();
            isDrawing = false;
            selectItem(tempPath);
            tempPath = null;
        }
    };

    // ======================
    // Tool Selection Logic
    // ======================
    const toolButtons = document.querySelectorAll('.tool-button');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Deactivate all tools
            toolButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Activate the selected tool
            const toolName = button.id.replace('-tool', '');
            currentTool = toolsObj[toolName];
            currentTool.activate();

            // Deselect any selected item when switching tools
            deselectItem();
        });
    });

    // Activate default tool (Select Tool)
    document.getElementById('select-tool').click();

    // ======================
    // Layer Management
    // ======================
    document.getElementById('add-layer').addEventListener('click', () => {
        const newLayer = new Layer();
        newLayer.name = `Layer ${project.layers.length}`;
        addLayerToUI(newLayer, newLayer.name);
        saveHistory();
    });

    function addLayerToUI(layer, layerName) {
        const listItem = document.createElement('li');
        listItem.textContent = layerName;
        listItem.dataset.layerId = layer.id;
        listItem.classList.add('active');
        layersList.appendChild(listItem);

        // Layer Controls (Delete Button)
        const layerControls = document.createElement('div');
        layerControls.classList.add('layer-controls');

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&#128465;'; // Trash can icon
        deleteBtn.title = 'Delete Layer';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering layer selection
            if (confirm(`Are you sure you want to delete "${layer.name}"?`)) {
                layer.remove();
                listItem.remove();
                saveHistory();
                deselectItem();
            }
        });

        layerControls.appendChild(deleteBtn);
        listItem.appendChild(layerControls);

        listItem.addEventListener('click', () => {
            selectLayer(layer, listItem);
        });

        // Activate the new layer
        selectLayer(layer, listItem);
    }

    function selectLayer(layer, listItem) {
        // Deactivate all layers in UI
        const allListItems = layersList.querySelectorAll('li');
        allListItems.forEach(item => item.classList.remove('active'));

        // Activate selected layer in UI
        listItem.classList.add('active');

        // Activate selected layer in Paper.js
        layer.activate();
    }

    function updateLayersUI() {
        layersList.innerHTML = '';
        project.layers.forEach(layer => {
            addLayerToUI(layer, layer.name);
        });
    }

    // ======================
    // Selection and Handle Management
    // ======================
    function selectItem(item) {
        if (selectedItem) {
            selectedItem.selected = false;
            removeHandles(selectedItem);
        }
        selectedItem = item;
        selectedItem.selected = true;
        addHandles(selectedItem);
        updatePropertiesPanel(selectedItem);
    }

    function deselectItem() {
        if (selectedItem) {
            selectedItem.selected = false;
            removeHandles(selectedItem);
            selectedItem = null;
            updatePropertiesPanel(null);
        }
    }

    function addHandles(item) {
        if (!(item instanceof Path)) return;

        item.segments.forEach(segment => {
            // Node Handle
            const nodeHandle = new Path.Circle({
                center: segment.point,
                radius: 6,
                fillColor: '#ff0000',
                strokeColor: '#000000',
                strokeWidth: 1,
                name: 'node-handle'
            });

            nodeHandle.onMouseDrag = function(event) {
                segment.point += event.delta;
                nodeHandle.position += event.delta;
                saveHistory();
                updatePropertiesPanel(item);
                updateHandlesPosition(item);
            };

            nodeHandle.onMouseEnter = function() {
                nodeHandle.scale(1.5);
            };

            nodeHandle.onMouseLeave = function() {
                nodeHandle.scale(1 / 1.5);
            };

            // Bezier Control Handles
            if (segment.handleOut) {
                const handleOut = new Path.Circle({
                    center: segment.point + segment.handleOut,
                    radius: 4,
                    fillColor: '#00ff00',
                    strokeColor: '#000000',
                    strokeWidth: 1,
                    name: 'handle-out'
                });

                handleOut.onMouseDrag = function(event) {
                    segment.handleOut += event.delta;
                    handleOut.position += event.delta;
                    saveHistory();
                    updatePropertiesPanel(item);
                };

                handleOut.onMouseEnter = function() {
                    handleOut.scale(1.5);
                };

                handleOut.onMouseLeave = function() {
                    handleOut.scale(1 / 1.5);
                };

                handles.push(handleOut);
            }

            if (segment.handleIn) {
                const handleIn = new Path.Circle({
                    center: segment.point + segment.handleIn,
                    radius: 4,
                    fillColor: '#0000ff',
                    strokeColor: '#000000',
                    strokeWidth: 1,
                    name: 'handle-in'
                });

                handleIn.onMouseDrag = function(event) {
                    segment.handleIn += event.delta;
                    handleIn.position += event.delta;
                    saveHistory();
                    updatePropertiesPanel(item);
                };

                handleIn.onMouseEnter = function() {
                    handleIn.scale(1.5);
                };

                handleIn.onMouseLeave = function() {
                    handleIn.scale(1 / 1.5);
                };

                handles.push(handleIn);
            }

            handles.push(nodeHandle);
        });
    }

    function removeHandles(item) {
        handles.forEach(handle => handle.remove());
        handles = [];
    }

    function updateHandlesPosition(item) {
        if (!(item instanceof Path)) return;

        let handleIndex = 0;
        item.segments.forEach(segment => {
            // Update node handle position
            const nodeHandle = handles[handleIndex++];
            if (nodeHandle && nodeHandle.name === 'node-handle') {
                nodeHandle.position = segment.point;
            }

            // Update handleOut position
            if (segment.handleOut) {
                const handleOut = handles[handleIndex++];
                if (handleOut && handleOut.name === 'handle-out') {
                    handleOut.position = segment.point + segment.handleOut;
                }
            }

            // Update handleIn position
            if (segment.handleIn) {
                const handleIn = handles[handleIndex++];
                if (handleIn && handleIn.name === 'handle-in') {
                    handleIn.position = segment.point + segment.handleIn;
                }
            }
        });
    }

    // ======================
    // Object Properties Panel
    // ======================
    function updatePropertiesPanel(item) {
        propertiesPanel.innerHTML = '';

        if (item) {
            // Position
            const posGroup = createPropertyGroup('Position (X, Y)', [
                createInput('number', item.position.x.toFixed(2), (e) => {
                    item.position.x = parseFloat(e.target.value);
                    saveHistory();
                    updateHandlesPosition(item);
                }),
                createInput('number', item.position.y.toFixed(2), (e) => {
                    item.position.y = parseFloat(e.target.value);
                    saveHistory();
                    updateHandlesPosition(item);
                })
            ]);
            propertiesPanel.appendChild(posGroup);

            // Size
            if (item.bounds) {
                const sizeGroup = createPropertyGroup('Size (Width, Height)', [
                    createInput('number', item.bounds.width.toFixed(2), (e) => {
                        item.bounds.width = parseFloat(e.target.value);
                        saveHistory();
                        updateHandlesPosition(item);
                    }),
                    createInput('number', item.bounds.height.toFixed(2), (e) => {
                        item.bounds.height = parseFloat(e.target.value);
                        saveHistory();
                        updateHandlesPosition(item);
                    })
                ]);
                propertiesPanel.appendChild(sizeGroup);
            }

            // Rotation
            const rotationGroup = createPropertyGroup('Rotation (Degrees)', [
                createInput('number', item.rotation.toFixed(2), (e) => {
                    item.rotation = parseFloat(e.target.value);
                    saveHistory();
                    updateHandlesPosition(item);
                })
            ]);
            propertiesPanel.appendChild(rotationGroup);

            // Stroke Color
            if (item.strokeColor) {
                const colorGroup = createPropertyGroup('Stroke Color', [
                    createColorInput(item.strokeColor.toCSS(true), (e) => {
                        item.strokeColor = new Color(e.target.value);
                        saveHistory();
                    })
                ]);
                propertiesPanel.appendChild(colorGroup);
            }

            // Fill Color (if applicable)
            if (item.fillColor) {
                const fillGroup = createPropertyGroup('Fill Color', [
                    createColorInput(item.fillColor.toCSS(true), (e) => {
                        item.fillColor = new Color(e.target.value);
                        saveHistory();
                    })
                ]);
                propertiesPanel.appendChild(fillGroup);
            }

            // Add/Remove Nodes for Paths
            if (item instanceof Path) {
                const nodeControls = createPropertyGroup('', [
                    createButton('Add Node', () => {
                        const bounds = item.bounds;
                        const newPoint = new Point(bounds.center.x, bounds.center.y);
                        item.add(new Point(newPoint.x, newPoint.y));
                        saveHistory();
                        addHandles(item);
                    }),
                    createButton('Remove Node', () => {
                        if (item.segments.length > 1) {
                            item.removeSegment(item.segments.length - 1);
                            saveHistory();
                            addHandles(item);
                        } else {
                            alert('Cannot remove the last segment.');
                        }
                    })
                ]);
                propertiesPanel.appendChild(nodeControls);
            }
        }
    }

    // Helper Functions for Properties Panel
    function createPropertyGroup(labelText, elements) {
        const group = document.createElement('div');
        group.classList.add('property-group');

        if (labelText) {
            const label = document.createElement('label');
            label.textContent = labelText;
            group.appendChild(label);
        }

        elements.forEach(element => group.appendChild(element));

        return group;
    }

    function createInput(type, value, onChange) {
        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        input.addEventListener('change', onChange);
        return input;
    }

    function createColorInput(value, onChange) {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = value;
        input.addEventListener('input', onChange);
        return input;
    }

    function createButton(text, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }

    // ======================
    // Modal Dialogs
    // ======================
    closeCodeModal.onclick = function() {
        codeModal.style.display = 'none';
    };

    closeHelpModal.onclick = function() {
        helpModal.style.display = 'none';
    };

    // Close modals when clicking outside the content
    window.onclick = function(event) {
        if (event.target == codeModal) {
            codeModal.style.display = 'none';
        }
        if (event.target == helpModal) {
            helpModal.style.display = 'none';
        }
    };

    // ======================
    // File Menu Actions
    // ======================
    document.getElementById('new-file').addEventListener('click', () => {
        if (confirm('Are you sure you want to create a new design? Unsaved changes will be lost.')) {
            project.clear();
            currentLayer = new Layer();
            currentLayer.name = `Layer ${project.layers.length}`;
            addLayerToUI(currentLayer, currentLayer.name);
            saveHistory();
            updatePropertiesPanel(null);
            deselectItem();
        }
    });

    document.getElementById('open-file').addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type === "application/json") {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    project.importJSON(e.target.result);
                    paper.view.update();
                    updateLayersUI();
                    saveHistory();
                    deselectItem();
                } catch (error) {
                    alert('Invalid file format.');
                }
            };
            reader.readAsText(file);
        } else {
            alert('Please select a valid JSON file.');
        }
    });

    document.getElementById('save-file').addEventListener('click', () => {
        const json = project.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'design.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('export-code').addEventListener('click', () => {
        const code = generatePhaserCode();
        phaserCodePre.textContent = code;
        codeModal.style.display = 'block';
    });

    // ======================
    // Edit Menu Actions
    // ======================
    document.getElementById('undo-action').addEventListener('click', () => {
        undo();
    });

    document.getElementById('redo-action').addEventListener('click', () => {
        redo();
    });

    // ======================
    // View Menu Actions
    // ======================
    document.getElementById('toggle-grid').addEventListener('click', () => {
        gridVisible = !gridVisible;
        gridOverlay.style.display = gridVisible ? 'block' : 'none';
    });

    // ======================
    // Help Menu Actions
    // ======================
    document.getElementById('open-help').addEventListener('click', () => {
        helpModal.style.display = 'block';
    });

    // ======================
    // Code Generation
    // ======================
    function generatePhaserCode() {
        let code = `
const config = {
    type: Phaser.AUTO,
    width: ${canvas.width},
    height: ${canvas.height},
    scene: {
        preload: preload,
        create: create
    }
};

const game = new Phaser.Game(config);

function preload() {
    // Preload assets if any
}

function create() {
`;

        project.layers.forEach((layer, layerIndex) => {
            code += `    // Layer ${layerIndex + 1}: ${layer.name}\n`;
            layer.children.forEach(item => {
                if (item instanceof Path) {
                    code += `    // Draw Path: ${item.name}\n`;
                    code += `    const graphics${layerIndex}${item.index} = this.add.graphics();\n`;
                    code += `    graphics${layerIndex}${item.index}.lineStyle(${item.strokeWidth || 2}, 0x${item.strokeColor.toCSS(true).substring(1)}, 1);\n`;
                    code += `    graphics${layerIndex}${item.index}.beginPath();\n`;
                    item.segments.forEach(segment => {
                        code += `    graphics${layerIndex}${item.index}.moveTo(${segment.point.x.toFixed(2)}, ${segment.point.y.toFixed(2)});\n`;
                        code += `    graphics${layerIndex}${item.index}.lineTo(${segment.point.x.toFixed(2)}, ${segment.point.y.toFixed(2)});\n`;
                    });
                    if (item.closed) {
                        code += `    graphics${layerIndex}${item.index}.closePath();\n`;
                    }
                    code += `    graphics${layerIndex}${item.index}.strokePath();\n\n`;
                } else if (item instanceof Shape.Rectangle) {
                    code += `    // Draw Rectangle: ${item.name}\n`;
                    code += `    this.add.rectangle(${item.position.x.toFixed(2)}, ${item.position.y.toFixed(2)}, ${item.bounds.width.toFixed(2)}, ${item.bounds.height.toFixed(2)}, 0x${item.strokeColor.toCSS(true).substring(1)}).setStrokeStyle(${item.strokeWidth || 2}, 0x${item.strokeColor.toCSS(true).substring(1)});\n\n`;
                } else if (item instanceof Shape.Circle) {
                    code += `    // Draw Circle: ${item.name}\n`;
                    code += `    this.add.circle(${item.position.x.toFixed(2)}, ${item.position.y.toFixed(2)}, ${item.radius.toFixed(2)}, 0x${item.strokeColor.toCSS(true).substring(1)}).setStrokeStyle(${item.strokeWidth || 2}, 0x${item.strokeColor.toCSS(true).substring(1)});\n\n`;
                }
                // Add more shape types as needed
            });
        });

        code += `}
`;
        return code;
    }

    // ======================
    // Responsive Canvas Resize
    // ======================
    window.addEventListener('resize', () => {
        paper.view.viewSize = new Size(canvas.clientWidth, canvas.clientHeight);
    });

    // ======================
    // Snapping Functionality (Optional)
    // ======================
    paper.view.onMouseUp = function(event) {
        if (gridVisible && selectedItem) {
            selectedItem.position = snapToGrid(selectedItem.position, gridSize);
            saveHistory();
        }
    };

    function snapToGrid(point, gridSize) {
        return new Point(
            Math.round(point.x / gridSize) * gridSize,
            Math.round(point.y / gridSize) * gridSize
        );
    }

    // ======================
    // Initialize
    // ======================
    function initialize() {
        addLayerToUI(currentLayer, currentLayer.name);
        saveHistory();
    }

    initialize();

    // ======================
    // Handle Node Editing (Duplicate Event Listener Fix)
    // ======================
    // Remove existing 'update' event listener to prevent duplication
    project.activeLayer.off('update', onLayerUpdate);

    project.activeLayer.on('update', onLayerUpdate);

    function onLayerUpdate(event) {
        if (selectedItem) {
            removeHandles(selectedItem);
            addHandles(selectedItem);
        }
    }

    // ======================
    // Touch Support
    // ======================
    function addTouchSupport() {
        // Map touch events to mouse events
        toolsObj.select.onTouchStart = toolsObj.select.onMouseDown;
        toolsObj.select.onTouchMove = toolsObj.select.onMouseMove;
        toolsObj.select.onTouchEnd = toolsObj.select.onMouseUp;

        toolsObj.line.onTouchStart = toolsObj.line.onMouseDown;
        toolsObj.line.onTouchMove = toolsObj.line.onMouseMove;
        toolsObj.line.onTouchEnd = toolsObj.line.onMouseUp;

        toolsObj.curve.onTouchStart = toolsObj.curve.onMouseDown;
        toolsObj.curve.onTouchMove = toolsObj.curve.onMouseMove;
        toolsObj.curve.onTouchEnd = toolsObj.curve.onMouseUp;

        toolsObj.rectangle.onTouchStart = toolsObj.rectangle.onMouseDown;
        toolsObj.rectangle.onTouchMove = toolsObj.rectangle.onMouseDrag;
        toolsObj.rectangle.onTouchEnd = toolsObj.rectangle.onMouseUp;

        toolsObj.circle.onTouchStart = toolsObj.circle.onMouseDown;
        toolsObj.circle.onTouchMove = toolsObj.circle.onMouseDrag;
        toolsObj.circle.onTouchEnd = toolsObj.circle.onMouseUp;
    }

    addTouchSupport();
};
