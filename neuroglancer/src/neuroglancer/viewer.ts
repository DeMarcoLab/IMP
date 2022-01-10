/**
 * @license
 * Copyright 2016 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import './viewer.css';
import 'neuroglancer/noselect.css';
//import { MongoClient } from 'mongodb'

import debounce from 'lodash/debounce';
import { CapacitySpecification, ChunkManager, ChunkQueueManager, FrameNumberCounter } from 'neuroglancer/chunk_manager/frontend';
import { makeCoordinateSpace, TrackableCoordinateSpace } from 'neuroglancer/coordinate_transform';
import { defaultCredentialsManager } from 'neuroglancer/credentials_provider/default_manager';
import { InputEventBindings as DataPanelInputEventBindings } from 'neuroglancer/data_panel_layout';
import { DataSourceProviderRegistry } from 'neuroglancer/datasource';
import { getDefaultDataSourceProvider } from 'neuroglancer/datasource/default_provider';
import { DisplayContext, TrackableWindowedViewport } from 'neuroglancer/display_context';
import { InputEventBindingHelpDialog } from 'neuroglancer/help/input_event_bindings';
import { addNewLayer, LayerManager, LayerSelectedValues, MouseSelectionState, SelectedLayerState, TopLevelLayerListSpecification, TrackableDataSelectionState } from 'neuroglancer/layer';
import { RootLayoutContainer } from 'neuroglancer/layer_groups_layout';
import { DisplayPose, NavigationState, OrientationState, Position, TrackableCrossSectionZoom, TrackableDepthRange, TrackableDisplayDimensions, TrackableProjectionZoom, TrackableRelativeDisplayScales, WatchableDisplayDimensionRenderInfo } from 'neuroglancer/navigation_state';
import { overlaysOpen } from 'neuroglancer/overlay';
import { allRenderLayerRoles, RenderLayerRole } from 'neuroglancer/renderlayer';
import { StatusMessage } from 'neuroglancer/status';
import { ElementVisibilityFromTrackableBoolean, TrackableBoolean, TrackableBooleanCheckbox } from 'neuroglancer/trackable_boolean';
import { makeDerivedWatchableValue, observeWatchable, TrackableValue, WatchableValueInterface } from 'neuroglancer/trackable_value';
import { ContextMenu } from 'neuroglancer/ui/context_menu';
import { DragResizablePanel } from 'neuroglancer/ui/drag_resize';
import { LayerInfoPanelContainer } from 'neuroglancer/ui/layer_side_panel';
import { setupPositionDropHandlers } from 'neuroglancer/ui/position_drag_and_drop';
import { SelectionDetailsTab } from 'neuroglancer/ui/selection_details';
import { StateEditorDialog } from 'neuroglancer/ui/state_editor';
import { StatisticsDisplayState, StatisticsPanel } from 'neuroglancer/ui/statistics';
import { removeParameterFromUrl } from 'neuroglancer/ui/url_hash_binding';
import { AutomaticallyFocusedElement } from 'neuroglancer/util/automatic_focus';
import { TrackableRGB } from 'neuroglancer/util/color';
import { Borrowed, Owned, RefCounted } from 'neuroglancer/util/disposable';
import { removeFromParent } from 'neuroglancer/util/dom';
import { registerActionListener } from 'neuroglancer/util/event_action_map';
import { vec3 } from 'neuroglancer/util/geom';
import { cancellableFetchOk, responseJson } from 'neuroglancer/util/http_request';
import { parseFixedLengthArray, verifyFinitePositiveFloat, verifyObject, verifyOptionalObjectProperty } from 'neuroglancer/util/json';
import { EventActionMap, KeyboardEventBinder } from 'neuroglancer/util/keyboard_bindings';
import { NullarySignal, Signal } from 'neuroglancer/util/signal';
import { CompoundTrackable, optionallyRestoreFromJsonMember } from 'neuroglancer/util/trackable';
import { ViewerState, VisibilityPrioritySpecification } from 'neuroglancer/viewer_state';
import { WatchableVisibilityPriority } from 'neuroglancer/visibility_priority/frontend';
import { GL } from 'neuroglancer/webgl/context';
import { AnnotationToolStatusWidget } from 'neuroglancer/widget/annotation_tool_status';
import { makeIcon } from 'neuroglancer/widget/icon';
import { NumberInputWidget } from 'neuroglancer/widget/number_input_widget';
import { MousePositionWidget, PositionWidget } from 'neuroglancer/widget/position_widget';
import { TrackableScaleBarOptions } from 'neuroglancer/widget/scale_bar';
import { RPC } from 'neuroglancer/worker_rpc';

declare var NEUROGLANCER_OVERRIDE_DEFAULT_VIEWER_OPTIONS: any

import './viewer.css';
import 'neuroglancer/noselect.css';
import { ObjectTracker_IMP } from './ObjectTracker_IMP';
import { makeVolumeChunkSpecificationWithDefaultCompression } from './sliceview/volume/base';

//import { completeQueryStringParameters } from './util/completion';




export function validateStateServer(obj: any) {
  return obj;
}

export class DataManagementContext extends RefCounted {
  worker: Worker;
  chunkQueueManager: ChunkQueueManager;
  chunkManager: ChunkManager;

  get rpc(): RPC {
    return this.chunkQueueManager.rpc!;
  }

  constructor(
    public gl: GL, public frameNumberCounter: FrameNumberCounter, bundleRoot: string = '') {
    super();
    const chunk_worker_url = bundleRoot + 'chunk_worker.bundle.js';
    this.worker = new Worker(chunk_worker_url);
    this.chunkQueueManager = this.registerDisposer(
      new ChunkQueueManager(new RPC(this.worker), this.gl, this.frameNumberCounter, {
        gpuMemory: new CapacitySpecification({ defaultItemLimit: 1e6, defaultSizeLimit: 1e9 }),
        systemMemory: new CapacitySpecification({ defaultItemLimit: 1e7, defaultSizeLimit: 2e9 }),
        download: new CapacitySpecification(
          { defaultItemLimit: 32, defaultSizeLimit: Number.POSITIVE_INFINITY }),
        compute: new CapacitySpecification({ defaultItemLimit: 128, defaultSizeLimit: 5e8 }),
      }));
    this.chunkQueueManager.registerDisposer(() => this.worker.terminate());
    this.chunkManager = this.registerDisposer(new ChunkManager(this.chunkQueueManager));

  }
}

export class InputEventBindings extends DataPanelInputEventBindings {
  global = new EventActionMap();
}

const viewerUiControlOptionKeys: (keyof ViewerUIControlConfiguration)[] = [
  'showHelpButton',
  'showEditStateButton',
  'showLayerPanel',
  'showLocation',
  'showLayerHoverValues',
  'showAnnotationToolStatus',
  'showJsonPostButton',
  'showDatabaseButton'
];

const viewerOptionKeys: (keyof ViewerUIOptions)[] =
  ['showUIControls', 'showPanelBorders', ...viewerUiControlOptionKeys];

export class ViewerUIControlConfiguration {
  showHelpButton = new TrackableBoolean(true);
  showEditStateButton = new TrackableBoolean(true);
  showJsonPostButton = new TrackableBoolean(true);
  showLayerPanel = new TrackableBoolean(true);
  showLocation = new TrackableBoolean(true);
  showLayerHoverValues = new TrackableBoolean(true);
  showAnnotationToolStatus = new TrackableBoolean(true);
  showDatabaseButton = new TrackableBoolean(true)
}

export class ViewerUIConfiguration extends ViewerUIControlConfiguration {
  /**
   * If set to false, all UI controls (controlled individually by the options below) are disabled.
   */
  showUIControls = new TrackableBoolean(true);
  showPanelBorders = new TrackableBoolean(true);
}


function setViewerUiConfiguration(
  config: ViewerUIConfiguration, options: Partial<ViewerUIOptions>) {
  for (const key of viewerOptionKeys) {
    const value = options[key];
    if (value !== undefined) {
      config[key].value = value;
    }
  }
}

interface ViewerUIOptions {
  showUIControls: boolean;
  showHelpButton: boolean;
  showEditStateButton: boolean;
  showLayerPanel: boolean;
  showLocation: boolean;
  showLayerHoverValues: boolean;
  showPanelBorders: boolean;
  showAnnotationToolStatus: boolean;
  showJsonPostButton: boolean;
  showDatabaseButton: boolean;
}

export interface ViewerOptions extends ViewerUIOptions, VisibilityPrioritySpecification {
  dataContext: Owned<DataManagementContext>;
  element: HTMLElement;
  dataSourceProvider: Borrowed<DataSourceProviderRegistry>;
  uiConfiguration: ViewerUIConfiguration;
  showLayerDialog: boolean;
  inputEventBindings: InputEventBindings;
  resetStateWhenEmpty: boolean;
  bundleRoot: string;
}

const defaultViewerOptions = 'undefined' !== typeof NEUROGLANCER_OVERRIDE_DEFAULT_VIEWER_OPTIONS ?
  NEUROGLANCER_OVERRIDE_DEFAULT_VIEWER_OPTIONS :
  {
    showLayerDialog: true,
    resetStateWhenEmpty: true,
  };

function makeViewerContextMenu(viewer: Viewer) {
  const menu = new ContextMenu();
  const { element } = menu;
  element.classList.add('neuroglancer-viewer-context-menu');
  const addLimitWidget = (label: string, limit: TrackableValue<number>) => {
    const widget = menu.registerDisposer(new NumberInputWidget(limit, { label }));
    widget.element.classList.add('neuroglancer-viewer-context-menu-limit-widget');
    element.appendChild(widget.element);
  };
  addLimitWidget('GPU memory limit', viewer.chunkQueueManager.capacities.gpuMemory.sizeLimit);
  addLimitWidget('System memory limit', viewer.chunkQueueManager.capacities.systemMemory.sizeLimit);
  addLimitWidget(
    'Concurrent chunk requests', viewer.chunkQueueManager.capacities.download.itemLimit);

  const addCheckbox = (label: string, value: TrackableBoolean) => {
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    const checkbox = menu.registerDisposer(new TrackableBooleanCheckbox(value));
    labelElement.appendChild(checkbox.element);
    element.appendChild(labelElement);
  };
  addCheckbox('Show axis lines', viewer.showAxisLines);
  addCheckbox('Show scale bar', viewer.showScaleBar);
  addCheckbox('Show cross sections in 3-d', viewer.showPerspectiveSliceViews);
  addCheckbox('Show default annotations', viewer.showDefaultAnnotations);
  addCheckbox('Show chunk statistics', viewer.statisticsDisplayState.visible);
  addCheckbox('Wire frame rendering', viewer.wireFrame);
  addCheckbox('Enable prefetching', viewer.chunkQueueManager.enablePrefetch);
  return menu;
}

class TrackableViewerState extends CompoundTrackable {
  constructor(public viewer: Borrowed<Viewer>) {
    super();
    this.add('dimensions', viewer.coordinateSpace);
    this.add('relativeDisplayScales', viewer.relativeDisplayScales);
    this.add('displayDimensions', viewer.displayDimensions);
    this.add('position', viewer.position);
    this.add('crossSectionOrientation', viewer.crossSectionOrientation);
    this.add('crossSectionScale', viewer.crossSectionScale);
    this.add('crossSectionDepth', viewer.crossSectionDepthRange);
    this.add('projectionOrientation', viewer.projectionOrientation);
    this.add('projectionScale', viewer.projectionScale);
    this.add('projectionDepth', viewer.projectionDepthRange);
    this.add('layers', viewer.layerSpecification);
    this.add('showAxisLines', viewer.showAxisLines);
    this.add('wireFrame', viewer.wireFrame);
    this.add('showScaleBar', viewer.showScaleBar);
    this.add('showDefaultAnnotations', viewer.showDefaultAnnotations);

    this.add('showSlices', viewer.showPerspectiveSliceViews);
    this.add('gpuMemoryLimit', viewer.dataContext.chunkQueueManager.capacities.gpuMemory.sizeLimit);
    this.add('prefetch', viewer.dataContext.chunkQueueManager.enablePrefetch);
    this.add(
      'systemMemoryLimit',
      viewer.dataContext.chunkQueueManager.capacities.systemMemory.sizeLimit);
    this.add(
      'concurrentDownloads', viewer.dataContext.chunkQueueManager.capacities.download.itemLimit);
    this.add('jsonStateServer', viewer.jsonStateServer);
    this.add('selectedLayer', viewer.selectedLayer);
    this.add('crossSectionBackgroundColor', viewer.crossSectionBackgroundColor);
    this.add('projectionBackgroundColor', viewer.perspectiveViewBackgroundColor);
    this.add('layout', viewer.layout);
    this.add('statistics', viewer.statisticsDisplayState);
    this.add('selection', viewer.selectionDetailsState);
    this.add('partialViewport', viewer.partialViewport);
  }

  restoreState(obj: any) {
    const { viewer } = this;
    super.restoreState(obj);
    // Handle legacy properties
    verifyOptionalObjectProperty(obj, 'navigation', navObj => {
      verifyObject(navObj);
      verifyOptionalObjectProperty(navObj, 'pose', poseObj => {
        verifyObject(poseObj);
        verifyOptionalObjectProperty(poseObj, 'position', positionObj => {
          verifyObject(positionObj);
          optionallyRestoreFromJsonMember(positionObj, 'voxelCoordinates', viewer.position);
          verifyOptionalObjectProperty(positionObj, 'voxelSize', voxelSizeObj => {
            // Handle legacy voxelSize representation
            const voxelSize =
              parseFixedLengthArray(new Float64Array(3), voxelSizeObj, verifyFinitePositiveFloat);
            for (let i = 0; i < 3; ++i) {
              voxelSize[i] *= 1e-9;
            }
            viewer.coordinateSpace.value = makeCoordinateSpace({
              valid: false,
              names: ['x', 'y', 'z'],
              units: ['m', 'm', 'm'],
              scales: voxelSize,
            });
          });
        });
        optionallyRestoreFromJsonMember(poseObj, 'orientation', viewer.crossSectionOrientation);
      });
      optionallyRestoreFromJsonMember(
        navObj, 'zoomFactor', viewer.crossSectionScale.legacyJsonView);
    });
    optionallyRestoreFromJsonMember(obj, 'perspectiveOrientation', viewer.projectionOrientation);
    optionallyRestoreFromJsonMember(obj, 'perspectiveZoom', viewer.projectionScale.legacyJsonView);
    optionallyRestoreFromJsonMember(
      obj, 'perspectiveViewBackgroundColor', viewer.perspectiveViewBackgroundColor);
  }
}

export class Viewer extends RefCounted implements ViewerState {
  coordinateSpace = new TrackableCoordinateSpace();
  position = this.registerDisposer(new Position(this.coordinateSpace));
  relativeDisplayScales =
    this.registerDisposer(new TrackableRelativeDisplayScales(this.coordinateSpace));
  displayDimensions = this.registerDisposer(new TrackableDisplayDimensions(this.coordinateSpace));
  displayDimensionRenderInfo = this.registerDisposer(new WatchableDisplayDimensionRenderInfo(
    this.relativeDisplayScales.addRef(), this.displayDimensions.addRef()));
  crossSectionOrientation = this.registerDisposer(new OrientationState());
  crossSectionScale = this.registerDisposer(
    new TrackableCrossSectionZoom(this.displayDimensionRenderInfo.addRef()));
  projectionOrientation = this.registerDisposer(new OrientationState());
  crossSectionDepthRange =
    this.registerDisposer(new TrackableDepthRange(-10, this.displayDimensionRenderInfo));
  projectionDepthRange =
    this.registerDisposer(new TrackableDepthRange(-50, this.displayDimensionRenderInfo));
  projectionScale =
    this.registerDisposer(new TrackableProjectionZoom(this.displayDimensionRenderInfo.addRef()));
  navigationState = this.registerDisposer(new NavigationState(
    new DisplayPose(
      this.position.addRef(), this.displayDimensionRenderInfo.addRef(),
      this.crossSectionOrientation.addRef()),
    this.crossSectionScale.addRef(), this.crossSectionDepthRange.addRef()));
  perspectiveNavigationState = this.registerDisposer(new NavigationState(
    new DisplayPose(
      this.position.addRef(), this.displayDimensionRenderInfo.addRef(),
      this.projectionOrientation.addRef()),
    this.projectionScale.addRef(), this.projectionDepthRange.addRef()));
  mouseState = new MouseSelectionState();
  layerManager = this.registerDisposer(new LayerManager());
  selectedLayer = this.registerDisposer(new SelectedLayerState(this.layerManager.addRef()));
  showAxisLines = new TrackableBoolean(true, true);
  wireFrame = new TrackableBoolean(false, false);
  showScaleBar = new TrackableBoolean(true, true);
  showPerspectiveSliceViews = new TrackableBoolean(true, true);
  visibleLayerRoles = allRenderLayerRoles();
  showDefaultAnnotations = new TrackableBoolean(true, true);
  crossSectionBackgroundColor = new TrackableRGB(vec3.fromValues(0.5, 0.5, 0.5));
  perspectiveViewBackgroundColor = new TrackableRGB(vec3.fromValues(0, 0, 0));
  scaleBarOptions = new TrackableScaleBarOptions();
  partialViewport = new TrackableWindowedViewport();
  contextMenu: ContextMenu;
  statisticsDisplayState = new StatisticsDisplayState();
  layerSelectedValues =
    this.registerDisposer(new LayerSelectedValues(this.layerManager, this.mouseState));
  selectionDetailsState = this.registerDisposer(
    new TrackableDataSelectionState(this.coordinateSpace, this.layerSelectedValues));

  resetInitiated = new NullarySignal();

  get chunkManager() {
    return this.dataContext.chunkManager;
  }
  get chunkQueueManager() {
    return this.dataContext.chunkQueueManager;
  }

  layerSpecification: TopLevelLayerListSpecification;
  layout: RootLayoutContainer;

  jsonStateServer = new TrackableValue<string>('', validateStateServer);
  state: TrackableViewerState;

  //testLayers: TrackableValue<Array<Object>>;
  dataContext: Owned<DataManagementContext>;
  visibility: WatchableVisibilityPriority;
  inputEventBindings: InputEventBindings;
  element: HTMLElement;
  dataSourceProvider: Borrowed<DataSourceProviderRegistry>;

  uiConfiguration: ViewerUIConfiguration;

  private makeUiControlVisibilityState(key: keyof ViewerUIOptions) {
    const showUIControls = this.uiConfiguration.showUIControls;
    const option = this.uiConfiguration[key];
    return this.registerDisposer(
      makeDerivedWatchableValue((a, b) => a && b, showUIControls, option));
  }

  /**
   * Logical and of each of the above values with the value of showUIControls.
   */
  uiControlVisibility:
    { [key in keyof ViewerUIControlConfiguration]: WatchableValueInterface<boolean> } = <any>{};

  showLayerDialog: boolean;
  resetStateWhenEmpty: boolean;

  get inputEventMap() {
    return this.inputEventBindings.global;
  }

  visible = true;

  constructor(public display: DisplayContext, options: Partial<ViewerOptions> = {}) {
    super();

    const {
      dataContext = new DataManagementContext(display.gl, display, options.bundleRoot),
      visibility = new WatchableVisibilityPriority(WatchableVisibilityPriority.VISIBLE),
      inputEventBindings = {
        global: new EventActionMap(),
        sliceView: new EventActionMap(),
        perspectiveView: new EventActionMap(),
      },
      element = display.makeCanvasOverlayElement(),
      dataSourceProvider =
      getDefaultDataSourceProvider({ credentialsManager: defaultCredentialsManager }),
      uiConfiguration = new ViewerUIConfiguration(),
    } = options;
    this.visibility = visibility;
    this.inputEventBindings = inputEventBindings;
    this.element = element;
    this.dataSourceProvider = dataSourceProvider;
    this.uiConfiguration = uiConfiguration;

    //this.testLayers = new TrackableValue<Array<Object>>([], validateStateServer)
    this.registerDisposer(observeWatchable(value => {
      this.display.applyWindowedViewportToElement(element, value);
    }, this.partialViewport));

    this.registerDisposer(() => removeFromParent(this.element));

    this.dataContext = this.registerDisposer(dataContext);

    setViewerUiConfiguration(uiConfiguration, options);

    const optionsWithDefaults = { ...defaultViewerOptions, ...options };
    const {
      resetStateWhenEmpty,
      showLayerDialog,
    } = optionsWithDefaults;

    for (const key of viewerUiControlOptionKeys) {
      this.uiControlVisibility[key] = this.makeUiControlVisibilityState(key);
    }
    this.registerDisposer(this.uiConfiguration.showPanelBorders.changed.add(() => {
      this.updateShowBorders();
    }));

    this.showLayerDialog = showLayerDialog;
    this.resetStateWhenEmpty = resetStateWhenEmpty;

    this.layerSpecification = new TopLevelLayerListSpecification(
      this.display, this.dataSourceProvider, this.layerManager, this.chunkManager,
      this.selectionDetailsState, this.selectedLayer, this.navigationState.coordinateSpace,
      this.navigationState.pose.position);

    this.registerDisposer(display.updateStarted.add(() => {
      this.onUpdateDisplay();
    }));

    this.showDefaultAnnotations.changed.add(() => {
      if (this.showDefaultAnnotations.value) {
        this.visibleLayerRoles.add(RenderLayerRole.DEFAULT_ANNOTATION);
      } else {
        this.visibleLayerRoles.delete(RenderLayerRole.DEFAULT_ANNOTATION);
      }
    });

    this.registerDisposer(this.navigationState.changed.add(() => {
      this.handleNavigationStateChanged();
    }));

    // Debounce this call to ensure that a transient state does not result in the layer dialog being
    // shown.
    const maybeResetState = this.registerCancellable(debounce(() => {
      if (!this.wasDisposed && this.layerManager.managedLayers.length === 0 &&
        this.resetStateWhenEmpty) {
        // No layers, reset state.
        this.navigationState.reset();
        this.perspectiveNavigationState.pose.orientation.reset();
        this.perspectiveNavigationState.zoomFactor.reset();
        this.resetInitiated.dispatch();
        if (!overlaysOpen && this.showLayerDialog && this.visibility.visible) {
          addNewLayer(this.layerSpecification, this.selectedLayer);
        }
      }
    }));
    this.layerManager.layersChanged.add(maybeResetState);
    maybeResetState();

    this.registerDisposer(this.dataContext.chunkQueueManager.visibleChunksChanged.add(() => {
      this.layerSelectedValues.handleLayerChange();
    }));

    this.registerDisposer(this.dataContext.chunkQueueManager.visibleChunksChanged.add(() => {
      if (this.visible) {
        display.scheduleRedraw();
      }
    }));

    this.makeUI();
    this.updateShowBorders();


    this.registerActionListeners();
    this.registerEventActionBindings();

    this.registerDisposer(setupPositionDropHandlers(element, this.navigationState.position));

    this.state = new TrackableViewerState(this);
  }

  private updateShowBorders() {
    const { element } = this;
    const className = 'neuroglancer-show-panel-borders';
    if (this.uiConfiguration.showPanelBorders.value) {
      element.classList.add(className);
    } else {
      element.classList.remove(className);
    }
  }

  private makeUI() {
    const gridContainer = this.element;
    gridContainer.classList.add('neuroglancer-viewer');
    gridContainer.classList.add('neuroglancer-noselect');
    gridContainer.style.display = 'flex';
    gridContainer.style.flexDirection = 'column';

    const topRow = document.createElement('div');
    topRow.title = 'Right click for settings';
    topRow.classList.add('neuroglancer-viewer-top-row');
    const contextMenu = this.contextMenu = this.registerDisposer(makeViewerContextMenu(this));
    contextMenu.registerParent(topRow);
    topRow.style.display = 'flex';
    topRow.style.flexDirection = 'row';
    topRow.style.alignItems = 'stretch';

    const positionWidget = this.registerDisposer(new PositionWidget(
      this.navigationState.position, this.layerSpecification.coordinateSpaceCombiner));
    this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
      this.uiControlVisibility.showLocation, positionWidget.element));
    topRow.appendChild(positionWidget.element);

    const mousePositionWidget = this.registerDisposer(new MousePositionWidget(
      document.createElement('div'), this.mouseState, this.navigationState.coordinateSpace));
    mousePositionWidget.element.style.flex = '1';
    mousePositionWidget.element.style.alignSelf = 'center';
    this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
      this.uiControlVisibility.showLocation, mousePositionWidget.element));
    topRow.appendChild(mousePositionWidget.element);

    const annotationToolStatus =
      this.registerDisposer(new AnnotationToolStatusWidget(this.selectedLayer));
    topRow.appendChild(annotationToolStatus.element);
    this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
      this.uiControlVisibility.showAnnotationToolStatus, annotationToolStatus.element));

    {
      const button = makeIcon({ text: '{}', title: 'Edit JSON state' });
      this.registerEventListener(button, 'click', () => {
        this.editJsonState();
      });
      this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
        this.uiControlVisibility.showEditStateButton, button));
      topRow.appendChild(button);
    }
    {
      const button = makeIcon({ text: '⇧', title: 'Post JSON to state server' });
      this.registerEventListener(button, 'click', () => {
        this.postJsonState();
      });
      this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
        this.uiControlVisibility.showJsonPostButton, button));
      topRow.appendChild(button);

    }

    {
      const button = makeIcon({ text: 'DB', title: 'Open Database Panel' });
      this.registerEventListener(button, 'click', () => {
        this.openDatabasePanel();
      });
      this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
        this.uiControlVisibility.showDatabaseButton, button));
      topRow.appendChild(button);

    }

    {
      const button = makeIcon({ text: '?', title: 'Help' });
      this.registerEventListener(button, 'click', () => {
        this.showHelpDialog();
      });
      this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
        this.uiControlVisibility.showHelpButton, button));
      topRow.appendChild(button);
    }

    this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
      makeDerivedWatchableValue(
        (...values: boolean[]) => values.reduce((a, b) => a || b, false),
        this.uiControlVisibility.showHelpButton, this.uiControlVisibility.showEditStateButton,
        this.uiControlVisibility.showLocation,
        this.uiControlVisibility.showAnnotationToolStatus),
      topRow));

    gridContainer.appendChild(topRow);

    const impMenu = document.createElement('div');
    impMenu.className = "imp-menu";

    const impMenu_title = document.createElement('div');
    impMenu_title.innerHTML = "Available layers";
    impMenu_title.className = "imp-menu-title";
    impMenu.appendChild(impMenu_title);
    const impMenu_availableLayers_div = document.createElement('div');
    impMenu_availableLayers_div.className = "imp-menu-available-layers";
    const availableLayers_list = document.createElement('ul');
    availableLayers_list.id = "imp-avail-layers-list";
    availableLayers_list.className = "db_ul";
    impMenu_availableLayers_div.appendChild(availableLayers_list);
    impMenu.appendChild(impMenu_availableLayers_div);

    const layoutAndSidePanel = document.createElement('div');
    layoutAndSidePanel.append(impMenu)
    layoutAndSidePanel.style.display = 'flex';
    layoutAndSidePanel.style.flex = '1';
    layoutAndSidePanel.style.flexDirection = 'row';
    this.layout = this.registerDisposer(new RootLayoutContainer(this, '4panel'));
    layoutAndSidePanel.appendChild(this.layout.element);

    const sidePanel = document.createElement('div');
    sidePanel.classList.add('neuroglancer-viewer-side-panel');
    layoutAndSidePanel.appendChild(sidePanel);

    const self = this;
    // FIXME: don't use selectedLayer.size/visible to control this
    const sidePanelVisible = {
      changed: new Signal(),
      get value() {
        return self.selectedLayer.visible || self.selectionDetailsState.visible.value;
      },
      set value(visible: boolean) {
        self.selectedLayer.visible = visible;
        self.selectionDetailsState.visible.value = visible;
      }
    };
    this.registerDisposer(this.selectedLayer.changed.add(sidePanelVisible.changed.dispatch));
    this.registerDisposer(
      this.selectionDetailsState.changed.add(sidePanelVisible.changed.dispatch));
    this.registerDisposer(new DragResizablePanel(
      sidePanel, sidePanelVisible, this.selectedLayer.size, 'horizontal', 290));
    const layerInfoPanel =
      this.registerDisposer(new LayerInfoPanelContainer(this.selectedLayer.addRef()));
    this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
      {
        changed: self.selectedLayer.changed,
        get value() {
          return self.selectedLayer.visible;
        },
      },
      layerInfoPanel.element));
    sidePanel.appendChild(layerInfoPanel.element);
    const selectionDetailsTab = this.registerDisposer(new SelectionDetailsTab(
      this.selectionDetailsState, this.layerSpecification, this.selectedLayer));
    sidePanel.appendChild(selectionDetailsTab.element);
    this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
      this.selectionDetailsState.visible, selectionDetailsTab.element));


    gridContainer.appendChild(layoutAndSidePanel);
    const statisticsPanel = this.registerDisposer(
      new StatisticsPanel(this.chunkQueueManager, this.statisticsDisplayState));
    gridContainer.appendChild(statisticsPanel.element);
    statisticsPanel.registerDisposer(new DragResizablePanel(
      statisticsPanel.element, this.statisticsDisplayState.visible,
      this.statisticsDisplayState.size, 'vertical'));

    const updateVisibility = () => {
      const shouldBeVisible = this.visibility.visible;
      if (shouldBeVisible !== this.visible) {
        gridContainer.style.visibility = shouldBeVisible ? 'inherit' : 'hidden';
        this.visible = shouldBeVisible;
      }
    };
    updateVisibility();
    this.registerDisposer(this.visibility.changed.add(updateVisibility));
  }

  /**
   * Called once by the constructor to set up event handlers.
   */
  private registerEventActionBindings() {
    const { element } = this;
    this.registerDisposer(new KeyboardEventBinder(element, this.inputEventMap));
    this.registerDisposer(new AutomaticallyFocusedElement(element));
  }

  bindAction(action: string, handler: () => void) {
    this.registerDisposer(registerActionListener(this.element, action, handler));
  }

  /**
   * Called once by the constructor to register the action listeners.
   */
  private registerActionListeners() {
    for (const action of ['recolor', 'clear-segments',]) {
      this.bindAction(action, () => {
        this.layerManager.invokeAction(action);
      });
    }

    for (const action of ['select']) {
      this.bindAction(action, () => {
        this.mouseState.updateUnconditionally();
        this.layerManager.invokeAction(action);
      });
    }

    this.bindAction('help', () => this.showHelpDialog());

    for (let i = 1; i <= 9; ++i) {
      this.bindAction(`toggle-layer-${i}`, () => {
        const layerIndex = i - 1;
        const layers = this.layerManager.managedLayers;
        if (layerIndex < layers.length) {
          let layer = layers[layerIndex];
          layer.setVisible(!layer.visible);
        }
      });
      this.bindAction(`toggle-pick-layer-${i}`, () => {
        const layerIndex = i - 1;
        const layers = this.layerManager.managedLayers;
        if (layerIndex < layers.length) {
          let layer = layers[layerIndex];
          layer.pickEnabled = !layer.pickEnabled;
        }
      });
      this.bindAction(`select-layer-${i}`, () => {
        const layerIndex = i - 1;
        const layers = this.layerManager.managedLayers;
        if (layerIndex < layers.length) {
          const layer = layers[layerIndex];
          this.selectedLayer.layer = layer;
          this.selectedLayer.visible = true;
        }
      });
    }

    this.bindAction('annotate', () => {
      const selectedLayer = this.selectedLayer.layer;
      if (selectedLayer === undefined) {
        StatusMessage.showTemporaryMessage('The annotate command requires a layer to be selected.');
        return;
      }
      const userLayer = selectedLayer.layer;
      if (userLayer === null || userLayer.tool.value === undefined) {
        StatusMessage.showTemporaryMessage(`The selected layer (${JSON.stringify(selectedLayer.name)}) does not have an active annotation tool.`);
        return;
      }
      userLayer.tool.value.trigger(this.mouseState);
    });

    this.bindAction('toggle-axis-lines', () => this.showAxisLines.toggle());
    this.bindAction('toggle-scale-bar', () => this.showScaleBar.toggle());
    this.bindAction('toggle-default-annotations', () => this.showDefaultAnnotations.toggle());
    this.bindAction('toggle-show-slices', () => this.showPerspectiveSliceViews.toggle());
    this.bindAction('toggle-show-statistics', () => this.showStatistics());
  }

  showHelpDialog() {
    const { inputEventBindings } = this;
    new InputEventBindingHelpDialog([
      ['Global', inputEventBindings.global],
      ['Cross section view', inputEventBindings.sliceView],
      ['3-D projection view', inputEventBindings.perspectiveView],
    ]);
  }


  loadFromJsonUrl() {
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('json_url')) {
      let json_url = urlParams.get('json_url')!;

      history.replaceState(null, '', removeParameterFromUrl(window.location.href, 'json_url'));
      StatusMessage
        .forPromise(
          cancellableFetchOk(json_url, {}, responseJson)
            .then(response => {
              //console.log(response)
              this.state.restoreState(response);

            }),
          {
            initialMessage: `Retrieving state from json_url: ${json_url}.`,
            delay: true,
            errorPrefix: `Error retrieving state: `,
          });
    }
  }



  //NH_Monash

  datasets = [] as Array<any>
  async connectToDatabase(url: string) {
    const axios = require('axios').default;
    axios.defaults.headers.post['Access-Control-Allow-Origin'] = '*'
    let self = this
    axios.get(url).then((response: any) => {
      self.datasets = response.data
    })
      .catch((error: any) => {
        console.error(error);
      })


  }

  currentDataset = {} as Object
  tryFetchByID(selected_id: string) {
    //console.log(selected_id)
    const axios = require('axios').default;
    const url: string = 'https://webdev.imp-db.cloud.edu.au:3005/tomosets/' + selected_id;
    let self = this
    axios.get(url).then((response: any) => {
      self.loadDBsetIntoNeuroglancer(response.data)
    })
      .catch((error: any) => {
        console.error(error);
      })
  }


  async loadDBsetIntoNeuroglancer(dataset: any) {
    if (dataset.stateFile.exists) {
      console.log("Has state file")
      let path = dataset.stateFile.path;
      StatusMessage
        .forPromise(
          cancellableFetchOk(path, {}, responseJson)
            .then(response => {
              console.log("response")
              this.state.restoreState(response);
            }),
          {
            initialMessage: `Retrieving state from json_url: ${path}.`,
            delay: true,
            errorPrefix: `Error retrieving state: `,
          });

    } else {
      console.log("Has no state file")
      this.navigationState.reset();
      this.perspectiveNavigationState.pose.orientation.reset();
      this.perspectiveNavigationState.zoomFactor.reset();
      this.resetInitiated.dispatch();
      if (!overlaysOpen && this.showLayerDialog && this.visibility.visible) {
        addNewLayer(this.layerSpecification, this.selectedLayer);
      }//reset state and load new one
      let layers = [] as Array<Object>;
      //image layer
      //console.log(dataset.dimensions)
      let dimensions = dataset.dimensions ? dataset.dimensions : { 'x': [1.0, 'nm'], 'y': [1.0, 'nm'], 'z': [1.0, 'nm'] }

      //get the header information
      const response = await fetch(dataset.image + "/" + dataset.name + ".json", { method: "GET" });
      let shaderstring = '#uicontrol invlerp normalized(range=[0.02,0.04], window=[-0.01, 0.1])';
      let position = [100, 100, 100]
      //let dimensions = [1,1,1]
      if (response.ok) {
        //if a header json exists, the correct posistion for the normalized brightness/contrast value is used. if no file is present, best guess defaults are used, which
        //are likely not great.
        const headerdata = await (response.json());
        //console.log(headerdata)
        if (!(headerdata.mean === 0 && headerdata.min === 0 && headerdata.max === 0)) {
          shaderstring = '#uicontrol invlerp normalized(range=[' + (headerdata.mean - (headerdata.mean - headerdata.min) / 2) + ',' + (headerdata.mean + (headerdata.max - headerdata.mean) / 2) + '], window=[' + headerdata.min + ',' + headerdata.max + '])';
        }
        position = [headerdata.x / 2, headerdata.y / 2, headerdata.z / 2];

        //console.log(Object.values(headerdata.pixel_spacing))

        if (headerdata.pixel_spacing)
          dimensions = { 'x': [headerdata.pixel_spacing[0], 'nm'], 'y': [headerdata.pixel_spacing[1], 'nm'], 'z': [headerdata.pixel_spacing[2], 'nm'] }; //if this is in the dataset info, should be more precise
      }

      const listElement = document.getElementById("imp-avail-layers-list");
      shaderstring += '\n#uicontrol int invertColormap slider(min=0, max=1, step=1, default=0)';
      shaderstring += '\n#uicontrol vec3 color color(default="white")';
      shaderstring += '\n float inverter(float val, int invert) {return 0.5 + ((2.0 * (-float(invert) + 0.5)) * (val - 0.5));}';
      shaderstring += '\nvoid main() {\n   emitRGB(color * inverter(normalized(), invertColormap));\n}\n';
      const imgLayer = { "type": "image", "visible":true,"source": "precomputed://" + dataset.image, "tab": "source", "name": dataset.name, "shader": shaderstring };
      //layers.push(imgLayer);
      const list_element = document.createElement("li");
      list_element.className="db_li";
      list_element.classList.add(this.getClassNamePerType("image"));
      ObjectTracker_IMP.getInstance().addLayer(imgLayer,true)
      list_element.onclick = () => {
        console.log(list_element.textContent)
        ObjectTracker_IMP.getInstance().toggleLayer(dataset.name)
      }
      list_element.textContent = dataset.name;
      listElement?.appendChild(list_element)      //let tmplayers = []
      //tmplayers.push(imgLayer)
      let names = []
      let colours = []
      if (dataset.layers) {
        for (let layer of dataset.layers) {
          if (layer) {

            //fetch the json for the annotations 
            const response = await fetch(layer.path, { method: "GET" });

            if (!response.ok) {
              console.log("Response is not ok: " + response.json());
              continue;
            }

            let resText = await (response.text())

            let re = new RegExp('(?<=\>)(.*?)(.json)', 'g');  //parses the resulting page for the file names present in that folder, format is a href="...."

            let sublayers = [...resText.matchAll(re)]

            let re1 = new RegExp('(?<=\>)(.*?)(.mesh)', 'g');
            let meshes = [...resText.matchAll(re1)]
            //console.log(meshes)
            let a = await fetch(layer.path + "/columns.json", { method: "GET" })
            let columns = await (a.json());

            //fetch each layer
            for (let sublayer of sublayers) {

              if (sublayer[0].indexOf("column") < 0) {

                const sublayerresponse = await fetch(layer.path + "/" + sublayer[0], { method: "GET" })
                const annots = await sublayerresponse.json()
                //console.log(annots)
                let shaderstring = "\n#uicontrol int colour_by slider(min=0,max=" + (columns.length > 0 ? columns.length : 1) + ")"
                shaderstring += "\nvoid main() {\n"
                //build ugly shaderstring TODO make this nice
                shaderstring += "\nif(colour_by==0) {\n        setColor(prop_color());\n}";
                //build configuration from available columns
                let annotationProperties = [{ "id": "color", "type": "rgb", "default": "red" }];
                for (let i = 0; i < columns.length; i++) {
                  let obj = { "id": columns[i], "type": "rgb", "default": "yellow" }
                  annotationProperties.push(obj)
                  //adjust shader string
                  shaderstring += "\nif(colour_by==" + (i + 1) + ") {\n        setColor(prop_" + columns[i] + "());\n}";
                }
                shaderstring += "\n}"
                const newLayer = {
                  "type": layer.type, "source": "local://annotations", "tab": "annotations", "name": sublayer[0].split(".json")[0],
                  "shader": shaderstring,
                  "annotationProperties": annotationProperties,
                  "annotations": annots,
                  "visible": false  //disable layer per default
                }

                const list_element = document.createElement("li");
                list_element.className="db_li";
                
                list_element.classList.add(this.getClassNamePerType(layer.type));
                list_element.textContent = sublayer[0].split(".json")[0];

                list_element.onclick = () => {
                  //console.log(list_element.textContent)
                  ObjectTracker_IMP.getInstance().toggleLayer(sublayer[0].split(".json")[0])
                }
                listElement?.appendChild(list_element)
            
                names.push(sublayer[0].split(".json")[0])
                colours.push(annots[0].props[0])
                //console.log(newLayer)
                ObjectTracker_IMP.getInstance().addLayer(newLayer,false)

              }



              /*try to load the mesh layer if available */
              for (let mesh of meshes) {
                if (mesh[1] === sublayer[0].split(".json")[0]) {
                  const meshlayer = {
                    "type": "segmentation",
                    "source": "precomputed://" + layer.path + mesh[0],
                    "tab": "segments",
                    "segmentDefaultColor": "red",
                    "name": sublayer[0].split(".json")[0] + "_mesh",
                    "visible":false
                  };
                  ObjectTracker_IMP.getInstance().addLayer(meshlayer,false)
                  const list_element = document.createElement("li");
                  list_element.className="db_li";
                  list_element.classList.add(this.getClassNamePerType("segmentation"));
                  list_element.textContent = meshlayer.name;
                  list_element.onclick = () => {
                    //console.log(list_element.textContent)
                    ObjectTracker_IMP.getInstance().toggleLayer(meshlayer.name)
  
                  }
                  listElement?.appendChild(list_element)
                }
              }
            }
            //console.log(ObjectTracker_IMP.getInstance().getLayers())

          }
        }



      }
      //console.log(layers)
      let myJSON = {

        "layout": "4panel",
        "partialViewport": [0, 0, 1, 1],
        "dimensions": dimensions,
        "position": position,
        "layers": layers,
        'crossSectionScale': 4,
        'selectedLayer': { 'layer': dataset.name, 'visible': true }

      }
      ObjectTracker_IMP.getInstance().setState(this.state);
      ObjectTracker_IMP.getInstance().setStateJSON(myJSON);
      ObjectTracker_IMP.getInstance().makeStateJSON();

      //add corresponding colour square to the labels 
      for (let i = 0; i < names.length; i++) {
        let name = names[i]
        let labeltabs = document.getElementsByClassName('neuroglancer-layer-item-label');

        for (let j = 0; j < labeltabs.length; j++) {
          let text = labeltabs[j].textContent
          if (text !== null) {
            if (text.indexOf(name) >= 0) {
              //console.log(labeltabs[j].parentElement)
              let colourSquare = document.createElement("div")
              colourSquare.className = 'imp-label-colour-square'
              colourSquare.style.backgroundColor = colours[i];
              labeltabs[j].parentElement?.appendChild(colourSquare);
            }
          }
        }

      }
    }

    
    //Proteomics
    //this constructs the div element with proteomics content. it is appended to the root node and not displayed. Once the proteomics tab is activated, this node is 
    //pulled to that panel and displayed there. 
    const rootNode = document.getElementById("neuroglancer-container")!;

    let responseElement = document.getElementById("proteomics-content")

    if (rootNode !== null) {

      if (responseElement !== null) {
        responseElement.textContent = ''
      } else {
        responseElement = document.createElement('div')
        responseElement.id = "proteomics-content"
        rootNode.append(responseElement)
      }


      if (dataset.proteomics.path) {
        let protTable = document.createElement("table")
        protTable.id = "proteomics-table"

        responseElement.append(protTable)

        let tableHead = document.createElement("thead")

        let trEl_head = document.createElement("tr")
        trEl_head.className = "proteomics-row"
        trEl_head.id = "protTableHeadRow"
        tableHead.append(trEl_head)
        protTable.append(tableHead)
        //table body
        let tbodyEl = document.createElement("tbody")
        tbodyEl.id = "protTableBody"
        protTable.append(tbodyEl)
        const response = await fetch(dataset.proteomics.path, { method: "GET" });
        const res = await response.json();

        const keys = []
        for (const item of res) {
          //fill the header row with the keys in the table
          if (trEl_head !== null && trEl_head.childElementCount == 0) {
            trEl_head.innerHTML = ''; //reset table
            for (const key of Object.keys(item)) {
              let tdEl = document.createElement("td")
              tdEl.textContent = key
              trEl_head.append(tdEl)
              keys.push(key)
            }
          }
          let rowEl = document.createElement("tr")
          for (const key of keys) {
            let tdEl1_ = document.createElement("td")
            tdEl1_.textContent = item[key]
            rowEl.append(tdEl1_)
          }

          if (tbodyEl !== null) {
            tbodyEl.append(rowEl)
          }
        }


      } else {
        //console.log("no proteomics")
        responseElement.textContent = "No Proteomics data found."
      }
      responseElement.style.display = "none"
      //console.log(responseElement)
    }


    //Metadata

    //this pulls the metadata and creates a node element as a child of the rootnode. Initially this is invisible, once the metadata tab is activated, the node will be appended
    //to that panel as a child.
    //all available metadata for layers will get their own content...
    if (rootNode !== null) {
      //console.log(response.toString())
      let responseElement = document.getElementById("metadataOptions-content")
      if (responseElement === null) {
        responseElement = document.createElement('div')
        responseElement.id = "metadataOptions-content"
        rootNode.append(responseElement)
        responseElement.style.display = "none"
      } else {
        responseElement.textContent = '';
      }
      let datasetMetadatadiv = document.createElement('div')
      datasetMetadatadiv.className = "metadata-dataset"
      let heading = document.createElement('h3')
      heading.textContent = "About this dataset"
      datasetMetadatadiv.append(heading)
      let datasetContent = document.createElement('p')
      if (dataset.metadata.text) {
        datasetContent.textContent = dataset.metadata.text;
      } else {
        datasetContent.textContent = "No metadata provided for this dataset."
      }
      datasetMetadatadiv.append(datasetContent)
      responseElement.append(datasetMetadatadiv)
      responseElement.append(document.createElement('hl'))

      //metadata about the selected layer
      let layerMetadatadiv = document.createElement('div')
      layerMetadatadiv.className = "metadata-layer"
      let layerheading = document.createElement('h3')
      layerheading.textContent = "About the selected layer"
      layerMetadatadiv.append(layerheading)

      for (const elem of dataset.layers) {
        let layerContent = document.createElement('div')
        layerContent.style.display = "none"
        layerContent.className = "layer-metadata-" + elem.name;
        if (elem.metadata) {
          layerContent.textContent = elem.metadata
        } else {
          layerContent.textContent = "No metadata available for this layer"
        }
        layerMetadatadiv.append(layerContent)
      }
      responseElement.append(layerMetadatadiv)

    }
  }

  getClassNamePerType(typ:string){
    let className = "";
           
                switch(typ){
                  case "image":
                    className = "ngImage";
                    break;
                  case "segmentation":
                    className = "ngSegmentation";
                    break;
                  case "annotation":
                    className = "ngAnnotation";
                    break;
                  default:
                    className = "ngDefault";

                }
                return className;
  }
  //uses the unique ID of a dataset to load data. this is either passed directly via the url .../?dataset_id=xyz  or after selecting one on the menu.

  promptJsonStateServer(message: string): void {
    let json_server_input = prompt(message, 'https://json.neurodata.io/v1');
    if (json_server_input !== null) {
      this.jsonStateServer.value = json_server_input;
      console.log('entered for JSON server:', this.jsonStateServer.value);
    } else {
      this.jsonStateServer.reset();
      console.log('cancelled');
    }
  }

  postJsonState() {
    // if jsonStateServer is not present prompt for value and store it in state
    if (!this.jsonStateServer.value) {
      this.promptJsonStateServer('No state server found. Please enter a server URL, or hit OK to use the default server.');
    }
    // upload state to jsonStateServer (only if it's defined)
    if (this.jsonStateServer.value) {
      StatusMessage.showTemporaryMessage(`Posting state to ${this.jsonStateServer.value}.`);
      cancellableFetchOk(
        this.jsonStateServer.value, { method: 'POST', body: JSON.stringify(this.state.toJSON()) },
        responseJson)
        .then(response => {
          console.log(response.uri);
          history.replaceState(
            null, '',
            window.location.origin + window.location.pathname + '?json_url=' + response.uri);
        })
        // catch errors with upload and prompt the user if there was an error
        .catch(() => {
          this.promptJsonStateServer('state server not responding, enter a new one?');
          if (this.jsonStateServer.value) {
            this.postJsonState();
          }
        });
    }
  }

  openDatabasePanel() {
    //console.log("button clicked");
    let db_panel = document.getElementById("db_panel")
    if (db_panel !== null) {
      db_panel.style.display = "block"
    } else {
      db_panel = document.createElement('div');
      db_panel.style.position = "absolute";
      db_panel.style.zIndex = "4000";
      db_panel.style.width = "50%";
      db_panel.style.height = "50%";
      db_panel.style.marginTop = "10%";
      db_panel.style.marginLeft = "25%";
      db_panel.id = "db_panel";
      const closeButton = document.createElement('button');
      closeButton.textContent = "Close";
      closeButton.className = "db_btn";
      closeButton.onclick = () => {
        if (db_panel !== null) {
          db_panel.style.display = "none"
        }
      }
      const topRow = document.createElement('div');
      topRow.style.display = "flex";
      topRow.style.justifyContent = "space-between";
      topRow.append(closeButton)

      const resultPanel = document.createElement('div');
      resultPanel.className = "db_result_list";
      const resultList = document.createElement('ul');
      resultList.className = "db_ul";
      for (var i = 0; i < this.datasets.length; i++) {
        var el = document.createElement('li')
        el.className = "db_li";
        el.textContent = this.datasets[i].name + " " + this.datasets[i]._id;

        el.onclick = (ev) => {
          //delete list of elemets
          let elList = document.getElementById("imp-avail-layers-list");
          ObjectTracker_IMP.getInstance().reset();
          elList!==null?elList.innerHTML="" : "";
          var element = ev.target as HTMLLIElement
          if (element.textContent) {
            this.tryFetchByID(element.textContent.split(" ")[1]);
          }
          if (db_panel) {
            //close panel upon dataset selection
            db_panel.style.display = "none"
          }


          //console.log(element.innerHTML)
        }
        resultList.append(el)
      }
      resultPanel.append(resultList)
      db_panel.append(topRow)
      db_panel.append(resultPanel)


      const rootNode = document.getElementById("neuroglancer-container")
      //console.log(rootNode)
      if (rootNode !== null) {
        rootNode.append(db_panel)
      }
    }
  }

  editJsonState() {
    new StateEditorDialog(this);
  }

  showStatistics(value: boolean | undefined = undefined) {
    if (value === undefined) {
      value = !this.statisticsDisplayState.visible.value;
    }
    this.statisticsDisplayState.visible.value = value;
  }

  get gl() {
    return this.display.gl;
  }

  onUpdateDisplay() {
    if (this.visible) {
      this.dataContext.chunkQueueManager.chunkUpdateDeadline = null;
    }
  }

  private handleNavigationStateChanged() {
    if (this.visible) {
      let { chunkQueueManager } = this.dataContext;
      if (chunkQueueManager.chunkUpdateDeadline === null) {
        chunkQueueManager.chunkUpdateDeadline = Date.now() + 10;
      }
    }
  }
}
