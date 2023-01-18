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
import './NH_style.css'; //cryoglancer: styles
import svg_controls_alt from 'ikonate/icons/controls-alt.svg';
import svg_layers from 'ikonate/icons/layers.svg';
import svg_list from 'ikonate/icons/list.svg';
import svg_settings from 'ikonate/icons/settings.svg';
import debounce from 'lodash/debounce';
import { CapacitySpecification, ChunkManager, ChunkQueueManager, FrameNumberCounter } from 'neuroglancer/chunk_manager/frontend';
import { makeCoordinateSpace, TrackableCoordinateSpace } from 'neuroglancer/coordinate_transform';
import { defaultCredentialsManager } from 'neuroglancer/credentials_provider/default_manager';
import { InputEventBindings as DataPanelInputEventBindings } from 'neuroglancer/data_panel_layout';
import { DataSourceProviderRegistry } from 'neuroglancer/datasource';
import { getDefaultDataSourceProvider } from 'neuroglancer/datasource/default_provider';
import { StateShare, stateShareEnabled } from 'neuroglancer/datasource/state_share';
import { DisplayContext, TrackableWindowedViewport } from 'neuroglancer/display_context';
import { HelpPanelState, InputEventBindingHelpDialog } from 'neuroglancer/help/input_event_bindings';
import { addNewLayer, LayerManager, LayerSelectedValues, MouseSelectionState, SelectedLayerState, TopLevelLayerListSpecification, TrackableDataSelectionState } from 'neuroglancer/layer';
import { RootLayoutContainer } from 'neuroglancer/layer_groups_layout';
import { DisplayPose, NavigationState, OrientationState, Position, TrackableCrossSectionZoom, TrackableDepthRange, TrackableDisplayDimensions, TrackableProjectionZoom, TrackableRelativeDisplayScales, WatchableDisplayDimensionRenderInfo } from 'neuroglancer/navigation_state';
import { overlaysOpen } from 'neuroglancer/overlay';
import { allRenderLayerRoles, RenderLayerRole } from 'neuroglancer/renderlayer';
import { StatusMessage } from 'neuroglancer/status';
import { ElementVisibilityFromTrackableBoolean, TrackableBoolean } from 'neuroglancer/trackable_boolean';
import { makeDerivedWatchableValue, observeWatchable, TrackableValue, WatchableValueInterface } from 'neuroglancer/trackable_value';
import { LayerArchiveCountWidget, LayerListPanel, LayerListPanelState } from 'neuroglancer/ui/layer_list_panel';
import { LayerSidePanelManager } from 'neuroglancer/ui/layer_side_panel';
import { setupPositionDropHandlers } from 'neuroglancer/ui/position_drag_and_drop';
import { SelectionDetailsPanel } from 'neuroglancer/ui/selection_details';
import { SidePanelManager } from 'neuroglancer/ui/side_panel';
import { StateEditorDialog } from 'neuroglancer/ui/state_editor';
import { StatisticsDisplayState, StatisticsPanel } from 'neuroglancer/ui/statistics';
import { ToolBinder } from 'neuroglancer/ui/tool';
import { ViewerSettingsPanel, ViewerSettingsPanelState } from 'neuroglancer/ui/viewer_settings';
import { AutomaticallyFocusedElement } from 'neuroglancer/util/automatic_focus';
import { TrackableRGB } from 'neuroglancer/util/color';
import { Borrowed, Owned, RefCounted } from 'neuroglancer/util/disposable';
import { removeFromParent } from 'neuroglancer/util/dom';
import { ActionEvent, registerActionListener } from 'neuroglancer/util/event_action_map';
import { vec3 } from 'neuroglancer/util/geom';
import { parseFixedLengthArray, verifyFinitePositiveFloat, verifyObject, verifyOptionalObjectProperty, verifyString } from 'neuroglancer/util/json';
import { EventActionMap, KeyboardEventBinder } from 'neuroglancer/util/keyboard_bindings';
import { NullarySignal } from 'neuroglancer/util/signal';
import { CompoundTrackable, optionallyRestoreFromJsonMember } from 'neuroglancer/util/trackable';
import { ViewerState, VisibilityPrioritySpecification } from 'neuroglancer/viewer_state';
import { WatchableVisibilityPriority } from 'neuroglancer/visibility_priority/frontend';
import { GL } from 'neuroglancer/webgl/context';
import { AnnotationToolStatusWidget } from 'neuroglancer/widget/annotation_tool_status';
import { CheckboxIcon } from 'neuroglancer/widget/checkbox_icon';
import { makeIcon } from 'neuroglancer/widget/icon';
import { MousePositionWidget, PositionWidget } from 'neuroglancer/widget/position_widget';
import { TrackableScaleBarOptions } from 'neuroglancer/widget/scale_bar';
import { RPC } from 'neuroglancer/worker_rpc';
import { Uint64 } from './util/uint64';

import { AnnotationUserLayer } from './annotation/user_layer';
import { AnnotationSource } from './annotation';
//cryoglancer: load own classes
import IMP_StateManager from './IMP_statemanager'; 
import { IMP_dbLoader } from './IMP_dbLoader';
import { SegmentationUserLayer } from './segmentation_user_layer';


declare var NEUROGLANCER_OVERRIDE_DEFAULT_VIEWER_OPTIONS: any

interface CreditLink {
  url: string;
  text: string;
}

declare var NEUROGLANCER_CREDIT_LINK: CreditLink | CreditLink[] | undefined;

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
          { defaultItemLimit: 100, defaultSizeLimit: Number.POSITIVE_INFINITY }),
        compute: new CapacitySpecification({ defaultItemLimit: 128, defaultSizeLimit: 5e8 }),
      }));
    this.chunkQueueManager.registerDisposer(() => this.worker.terminate());
    this.chunkManager = this.registerDisposer(new ChunkManager(this.chunkQueueManager));
  }
}

export class InputEventBindings extends DataPanelInputEventBindings {
  global = new EventActionMap();
}

export const VIEWER_TOP_ROW_CONFIG_OPTIONS = [
  'showHelpButton',
  'showSettingsButton',
  'showEditStateButton',
  'showLayerListPanelButton',
  'showSelectionPanelButton',
  'showLayerSidePanelButton',
  'showLocation',
  'showAnnotationToolStatus',
  'showDatabaseButton' //cryoglancer
] as const;

export const VIEWER_UI_CONTROL_CONFIG_OPTIONS = [
  ...VIEWER_TOP_ROW_CONFIG_OPTIONS,
  'showLayerPanel',
  'showLayerHoverValues',
] as const;

export const VIEWER_UI_CONFIG_OPTIONS = [
  ...VIEWER_UI_CONTROL_CONFIG_OPTIONS,
  'showUIControls',
  'showPanelBorders',
] as const;

export type ViewerUIOptions = {
  [Key in (typeof VIEWER_UI_CONFIG_OPTIONS)[number]]: boolean
};

export type ViewerUIConfiguration = {
  [Key in (typeof VIEWER_UI_CONFIG_OPTIONS)[number]]: TrackableBoolean;
};

export function makeViewerUIConfiguration(): ViewerUIConfiguration {
  return Object.fromEntries(VIEWER_UI_CONFIG_OPTIONS.map(
    key => [key, new TrackableBoolean(true)])) as ViewerUIConfiguration;
}

function setViewerUiConfiguration(
  config: ViewerUIConfiguration, options: Partial<ViewerUIOptions>) {
  for (const key of VIEWER_UI_CONFIG_OPTIONS) {
    const value = options[key];
    if (value !== undefined) {
      config[key].value = value;
    }
  }
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

class TrackableViewerState extends CompoundTrackable {
  constructor(public viewer: Borrowed<Viewer>) {
    super();
    this.add('title', viewer.title);
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
    this.add('selectedLayer', viewer.selectedLayer);
    this.add('crossSectionBackgroundColor', viewer.crossSectionBackgroundColor);
    this.add('projectionBackgroundColor', viewer.perspectiveViewBackgroundColor);
    this.add('layout', viewer.layout);
    this.add('statistics', viewer.statisticsDisplayState);
    this.add('helpPanel', viewer.helpPanelState);
    this.add('settingsPanel', viewer.settingsPanelState);
    this.add('selection', viewer.selectionDetailsState);
    this.add('layerListPanel', viewer.layerListPanelState);
    this.add('partialViewport', viewer.partialViewport);
    this.add('selectedStateServer', viewer.selectedStateServer);
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
  title = new TrackableValue<string | undefined>(undefined, verifyString);
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
  crossSectionBackgroundColor = new TrackableRGB(vec3.fromValues(1, 1, 1));
  perspectiveViewBackgroundColor = new TrackableRGB(vec3.fromValues(1, 1, 1));
  scaleBarOptions = new TrackableScaleBarOptions();
  partialViewport = new TrackableWindowedViewport();
  statisticsDisplayState = new StatisticsDisplayState();
  helpPanelState = new HelpPanelState();
  settingsPanelState = new ViewerSettingsPanelState();
  layerSelectedValues =
    this.registerDisposer(new LayerSelectedValues(this.layerManager, this.mouseState));
  selectionDetailsState = this.registerDisposer(
    new TrackableDataSelectionState(this.coordinateSpace, this.layerSelectedValues));
  selectedStateServer = new TrackableValue<string>('', verifyString);
  layerListPanelState = new LayerListPanelState();

  resetInitiated = new NullarySignal();

  get chunkManager() {
    return this.dataContext.chunkManager;
  }
  get chunkQueueManager() {
    return this.dataContext.chunkQueueManager;
  }

  layerSpecification: TopLevelLayerListSpecification;
  layout: RootLayoutContainer;
  sidePanelManager: SidePanelManager;

  state: TrackableViewerState;

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
   * Logical and of each `VIEWER_UI_CONTROL_CONFIG_OPTIONS` option with the value of showUIControls.
   */
  uiControlVisibility: {
    [key in (typeof VIEWER_UI_CONTROL_CONFIG_OPTIONS)[number]]: WatchableValueInterface<boolean>
  } = <any>{};

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
        imp: new EventActionMap(),
        global: new EventActionMap(),
        sliceView: new EventActionMap(),
        perspectiveView: new EventActionMap(),
      },
      element = display.makeCanvasOverlayElement(),
      dataSourceProvider =
      getDefaultDataSourceProvider({ credentialsManager: defaultCredentialsManager }),
      uiConfiguration = makeViewerUIConfiguration(),
    } = options;
    this.visibility = visibility;
    this.inputEventBindings = inputEventBindings;
    this.element = element;
    this.dataSourceProvider = dataSourceProvider;
    this.uiConfiguration = uiConfiguration;

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

    for (const key of VIEWER_UI_CONTROL_CONFIG_OPTIONS) {
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
      this.navigationState.pose.position, this.toolBinder);

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
    topRow.classList.add('neuroglancer-viewer-top-row');
    topRow.style.display = 'flex';
    topRow.style.flexDirection = 'row';
    topRow.style.alignItems = 'stretch';

    const positionWidget = this.registerDisposer(new PositionWidget(
      this.navigationState.position, this.layerSpecification.coordinateSpaceCombiner));
    this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
      this.uiControlVisibility.showLocation, positionWidget.element));
    topRow.appendChild(positionWidget.element);


    //****************************cryoglancer block 1 start
    //creates the colour by element in the top row
    let colorByDiv = document.createElement("div");
    colorByDiv.id = "imp-color-by-div"; //this ID will  be used later to populate the dropdownlist
    colorByDiv.style.display = "flex";
    //colorByDiv.style.alignItems='stretch';
    topRow.appendChild(colorByDiv);

    //create a "group" button, which will enable grouping of segments in a new layer.
    let button = document.createElement("div");
    button.className = "btn-group neuroglancer-icon";
    button.innerText = "Create Group...";
    button.title = "Toggle Group mode. When toggled on, CTRL+Click to (de)select meshes. Click button again to add group to a new layer.";
    button.onclick = () => {
      IMP_StateManager.getInstance().toggleGroupingMode();
      console.log(IMP_StateManager.getInstance().isGrouping());
      if (IMP_StateManager.getInstance().isGrouping()) {
        button.innerText = "Finished creating group";
      } else {
        button.innerText = "Create Group...";
      }
    }
    topRow.appendChild(button);
    //****************************cryoglancer block 1 stop


    const mousePositionWidget = this.registerDisposer(new MousePositionWidget(
      document.createElement('div'), this.mouseState, this.navigationState.coordinateSpace));
    mousePositionWidget.element.style.flex = '1';

    mousePositionWidget.element.style.alignSelf = 'center';
    this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
      this.uiControlVisibility.showLocation, mousePositionWidget.element));
    topRow.appendChild(mousePositionWidget.element);

    if (typeof NEUROGLANCER_CREDIT_LINK !== 'undefined') {
      let creditInfo = NEUROGLANCER_CREDIT_LINK!;
      if (!Array.isArray(creditInfo)) {
        creditInfo = [creditInfo];
      }
      for (const { url, text } of creditInfo) {
        const creditLink = document.createElement('a');
        creditLink.style.marginRight = '5px';
        creditLink.href = url;
        creditLink.textContent = text;
        creditLink.style.fontFamily = 'sans-serif';
        creditLink.style.color = 'yellow';
        creditLink.target = '_blank';
        topRow.appendChild(creditLink);
      }
    }

    const annotationToolStatus =
      this.registerDisposer(new AnnotationToolStatusWidget(this.selectedLayer, this.toolBinder));
    topRow.appendChild(annotationToolStatus.element);
    this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
      this.uiControlVisibility.showAnnotationToolStatus, annotationToolStatus.element));

    if (stateShareEnabled) {
      const stateShare = this.registerDisposer(new StateShare(this));
      topRow.appendChild(stateShare.element);
    }

    {
      const { layerListPanelState } = this;
      const button =
        this.registerDisposer(new CheckboxIcon(layerListPanelState.location.watchableVisible, {
          svg: svg_layers,
          backgroundScheme: 'dark',
          enableTitle: 'Show layer list panel',
          disableTitle: 'Hide layer list panel'
        }));
      button.element.insertAdjacentElement(
        'afterbegin',
        this.registerDisposer(new LayerArchiveCountWidget(this.layerManager)).element);
      this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
        this.uiControlVisibility.showLayerListPanelButton, button.element));
      topRow.appendChild(button.element);
    }

    {
      const { selectionDetailsState } = this;
      const button =
        this.registerDisposer(new CheckboxIcon(selectionDetailsState.location.watchableVisible, {
          svg: svg_list,
          backgroundScheme: 'dark',
          enableTitle: 'Show selection details panel',
          disableTitle: 'Hide selection details panel'
        }));
      this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
        this.uiControlVisibility.showSelectionPanelButton, button.element));
      topRow.appendChild(button.element);
    }

    {
      const { selectedLayer } = this;
      const button = this.registerDisposer(new CheckboxIcon(
        {
          get value() {
            return selectedLayer.visible;
          },
          set value(visible: boolean) {
            selectedLayer.visible = visible;
          },
          changed: selectedLayer.location.locationChanged,
        },
        {
          svg: svg_controls_alt,
          backgroundScheme: 'dark',
          enableTitle: 'Show layer side panel',
          disableTitle: 'Hide layer side panel'
        }));
      this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
        this.uiControlVisibility.showLayerSidePanelButton, button.element));
      topRow.appendChild(button.element);
    }

    {
      const button = makeIcon({ text: '{}', title: 'Edit JSON state' });
      this.registerEventListener(button, 'click', () => {
        this.editJsonState();
      });
      this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
        this.uiControlVisibility.showEditStateButton, button));
      topRow.appendChild(button);
    }

    //****************************cryoglancer block 2 start

    //Download the segments that are currently visible in the same format as the particle list were initially provided
    {
      const button = makeIcon({ text: '⭳', title: 'Download visible segment list' });
      this.registerEventListener(button, 'click', () => {
        this.openDownloadOptionPanel();
        //IMP_StateManager.getInstance().downloadActiveSegments();
        //IMP_StateManager.getInstance().downloadVisibleAnnotations();
      });

      topRow.appendChild(button);

    }

    //Load a view state from the database
    {
      const button = makeIcon({ text: '+', title: 'Load a previously saved state' });
      this.registerEventListener(button, 'click', () => {
        this.createLoadStatePanel();
      });

      topRow.appendChild(button);

    }

    //save the current view in the database
    {
      const button = makeIcon({ text: '🖫', title: 'Save current state.' });
      this.registerEventListener(button, 'click', () => {
        this.createSaveStatePanel();

      });

      topRow.appendChild(button);

    }
    //****************************cryoglancer block 2 stop


    {
      const { helpPanelState } = this;
      const button =
        this.registerDisposer(new CheckboxIcon(helpPanelState.location.watchableVisible, {
          text: '?',
          backgroundScheme: 'dark',
          enableTitle: 'Show help panel',
          disableTitle: 'Hide help panel'
        }));
      this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
        this.uiControlVisibility.showHelpButton, button.element));
      topRow.appendChild(button.element);
    }

    {
      const { settingsPanelState } = this;
      const button =
        this.registerDisposer(new CheckboxIcon(settingsPanelState.location.watchableVisible, {
          svg: svg_settings,
          backgroundScheme: 'dark',
          enableTitle: 'Show settings panel',
          disableTitle: 'Hide settings panel'
        }));
      this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
        this.uiControlVisibility.showSettingsButton, button.element));
      topRow.appendChild(button.element);
    }

    this.registerDisposer(new ElementVisibilityFromTrackableBoolean(
      makeDerivedWatchableValue(
        (...values: boolean[]) => values.reduce((a, b) => a || b, false),
        ...VIEWER_TOP_ROW_CONFIG_OPTIONS.map(key => this.uiControlVisibility[key])),
      topRow));

    gridContainer.appendChild(topRow);

    this.layout = this.registerDisposer(new RootLayoutContainer(this, '4panel'));
    this.sidePanelManager = this.registerDisposer(
      new SidePanelManager(this.display, this.layout.element, this.visibility));
    this.registerDisposer(this.sidePanelManager.registerPanel({
      location: this.layerListPanelState.location,
      makePanel: () =>
        new LayerListPanel(this.sidePanelManager, this.layerSpecification, this.layerListPanelState),
    }));
    this.registerDisposer(
      new LayerSidePanelManager(this.sidePanelManager, this.selectedLayer.addRef()));
    this.registerDisposer(this.sidePanelManager.registerPanel({
      location: this.selectionDetailsState.location,
      makePanel: () => new SelectionDetailsPanel(
        this.sidePanelManager, this.selectionDetailsState, this.layerSpecification,
        this.selectedLayer),
    }));
    gridContainer.appendChild(this.sidePanelManager.element);

    this.registerDisposer(this.sidePanelManager.registerPanel({
      location: this.statisticsDisplayState.location,
      makePanel: () => new StatisticsPanel(
        this.sidePanelManager, this.chunkQueueManager, this.statisticsDisplayState),
    }));

    this.registerDisposer(this.sidePanelManager.registerPanel({
      location: this.helpPanelState.location,
      makePanel: () => {
        const { inputEventBindings } = this;
        return new InputEventBindingHelpDialog(
          this.sidePanelManager,
          this.helpPanelState,
          [
            ['IMP specific Bindings', inputEventBindings.imp], //cryoglancer
            ['Global', inputEventBindings.global],
            ['Cross section view', inputEventBindings.sliceView],
            ['3-D projection view', inputEventBindings.perspectiveView]
          ],
          this.layerManager,
          this.toolBinder,
        );
      },
    }));

    this.registerDisposer(this.sidePanelManager.registerPanel({
      location: this.settingsPanelState.location,
      makePanel: () =>
        new ViewerSettingsPanel(this.sidePanelManager, this.settingsPanelState, this),
    }));

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

  //****************************cryoglancer block 3 start 

  //opens small panel that lets user chose to either download all visible meshes or all visible annotations ("dots")
  //could use some styling
  private openDownloadOptionPanel(){
    let panel = document.createElement("div");
    panel.className = "downloadOptionsPanel ";

   let buttonA = document.createElement("button");
   buttonA.className="btn-download  neuroglancer-icon"
   buttonA.innerHTML="Download annotations"
   buttonA.onclick = () => {
        IMP_StateManager.getInstance().downloadVisibleAnnotations();
        panel.remove();
   }
   panel.appendChild(buttonA);
   let buttonB = document.createElement("button");
   buttonB.className=" btn-download neuroglancer-icon"
   buttonB.innerHTML="Download meshes"
   buttonB.onclick = () => {
        IMP_StateManager.getInstance().downloadActiveSegments();
        panel.remove();
   }
   panel.appendChild(buttonB);
   const rootNode = document.getElementById("neuroglancer-container");
   if (rootNode) {
     rootNode.appendChild(panel);
   }
  }

  //displays a panel with a list of saved states for this dataset
  //TODO: add users to the states and only show the ones assigned to a user
  private createLoadStatePanel() {
    let savedStates = IMP_dbLoader.getInstance().getSaveStates();
    let statesArr = []
    if (savedStates === undefined) {
      statesArr[0] = "No saved states available yet."
    } else {
      statesArr = savedStates;
    }

    let panel = document.createElement("div");
    panel.className = "loadStatePanel";

    let stateListEl = document.createElement("ul");
    stateListEl.className = "db_ul"
    panel.appendChild(stateListEl);
    for (let el of statesArr) {
      let liEl = document.createElement("li");
      liEl.innerHTML = el;
      liEl.className = "db_li"
      if (el !== "No saved states available yet") {
        let self = this;
        liEl.onclick = () => {
         // console.log("loading " + liEl.innerHTML);
          let newState = IMP_dbLoader.getInstance().loadSaveState(liEl.innerHTML);
         // console.log(newState)
          self.state.reset();
          self.state.restoreState(newState);
          panel.style.display = "none";
        }
      }
      stateListEl.appendChild(liEl)

    }
    let closeButton = document.createElement("button");
    closeButton.innerHTML = "Close";

    panel.appendChild(closeButton);
    closeButton.onclick = () => {
      panel.style.display = "none";
    }
    const rootNode = document.getElementById("neuroglancer-container");
    if (rootNode) {
      rootNode.appendChild(panel);
    }

  }

  //creates a panel to save the current view. User can give it a name and option to overwrite an existing state of the same name
  //all very basic with not error handling
  private createSaveStatePanel() {
    let panel = document.createElement("div");
    panel.className = "saveStatePanel";
    let labelElName = document.createElement("label");
    labelElName.setAttribute("for", "inputElName");
    labelElName.innerHTML = "Name save State";
    let inputElName = document.createElement("input");
    inputElName.type = "text";
    panel.appendChild(labelElName);
    panel.appendChild(inputElName);

    let labeloverWriteName = document.createElement("label");
    labeloverWriteName.setAttribute("for", "overwriteCheckboxEl");
    labeloverWriteName.innerHTML = "Overwrite existing state?";
    let overwriteCheckboxEl = document.createElement("input");
    overwriteCheckboxEl.type = "checkbox";
    overwriteCheckboxEl.checked = false;
    panel.appendChild(overwriteCheckboxEl);
    let submitButton = document.createElement("button");
    submitButton.innerHTML = "Submit";
    let infoText = document.createElement("div");
    panel.appendChild(infoText);
    panel.appendChild(submitButton);


    submitButton.onclick = () => {
      IMP_dbLoader.getInstance().saveState(inputElName.value, this.state, overwriteCheckboxEl.checked).then((res: any) => {
        infoText.innerHTML = res;
        submitButton.innerHTML = "Close";
        submitButton.onclick = () => {
          panel.style.display = "none";
        }
      })

    }
    let closeButton = document.createElement("button");
    closeButton.innerHTML = "Close";

    panel.appendChild(closeButton);
    closeButton.onclick = () => {
      panel.style.display = "none";
    }
    const rootNode = document.getElementById("neuroglancer-container");
    if (rootNode) {
      rootNode.appendChild(panel);
    }

    //****************************cryoglancer block 3 stop


  }
  /**
   * Called once by the constructor to set up event handlers.
   */
  private registerEventActionBindings() {
    const { element } = this;
    this.registerDisposer(new KeyboardEventBinder(element, this.inputEventMap));
    this.registerDisposer(new AutomaticallyFocusedElement(element));
  }

  bindAction<Data>(action: string, handler: (event: ActionEvent<Data>) => void) {
    this.registerDisposer(registerActionListener(this.element, action, handler));
  }

  ////****************************cryoglancer block 4 start 
  //cryoglancer: determines which item has been clicked (annotation or mesh layer)
  //determines the name of the layer the clicked mesh is in
  private getClickedMeshId_LayerName() {
    let vals = this.layerSelectedValues.toJSON(); //neuroglancer state object which keeps track of what has been clicked
    let returnee = { "name": "-1", "id": "-1" }
    for (let i = 0; i < Object.keys(vals).length; i++) {
      let key = Object.keys(vals)[i];
      // console.log(vals[key])
      if ( typeof (vals[key]["value"]) === "string" && vals[key]["value"].indexOf("#") < 0) {
        returnee.name = key;
        returnee.id = vals[key]["value"]
        return returnee;
      } else {
        if (vals[key].annotationId) {
          returnee.name = key + "_mesh";
          returnee.id = vals[key].annotationId;
          return returnee;
        }
      }
    }
    return null;
  }

  //get id of clicked annotation ("dot")
  private getClickedAnnotationId() {
    let vals = this.layerSelectedValues.toJSON();
    let returnee = { "name": "-1", "id": "-1" }
    for (let i = 0; i < Object.keys(vals).length; i++) {
      let key = Object.keys(vals)[i];
      // console.log(vals[key])

      if (vals[key].annotationId) {
        returnee.name = key;
        returnee.id = vals[key].annotationId;
        return returnee;
      }

    }
    return null;
  }
  //****************************cryoglancer block 4 stop
  
  
  /**
   * Called once by the constructor to register the action listeners.
   */
  private registerActionListeners() {
    for (const action of ['recolor', 'clear-segments']) {
      this.bindAction(action, () => {
        this.layerManager.invokeAction(action);
      });
    }

    //****************************cryoglancer block 5 start 
    this.bindAction('color-picker', () => {
      //the color picker is buggy at best. might be best to disable
      IMP_StateManager.getInstance().doClickReaction('dblClick', this.getClickedMeshId_LayerName()!.id);
    })

    /*deletes the annotation under the mouse cursor */
    this.bindAction('delete-annotation', () => {
      const clickies = this.getClickedAnnotationId();
      if(clickies===null){
        return;
      }
     // console.log(clickies)
      const layers = this.layerManager.managedLayers;
      for (let lay of layers) {

        if (lay !== null && lay["layer_"] !== null && lay["name_"] === clickies!["name"]) {
          //console.log(lay["layer_"])
          //console.log(clickies)
          let lays = lay["layer_"] as AnnotationUserLayer;
          let source = lays.localAnnotations as AnnotationSource;
          const ref = source.getReference(clickies.id);
          try {
            source.delete(ref); //deletes the annotation
          } finally {
            ref.dispose();
          }
          IMP_StateManager.getInstance().deleteID(clickies.id);
          //lays!.localAnnotations.annotationMap.delete(clickies!.id);
         //localAnnotations
//: 
//LocalAnnotationSource
//annotationMap
//: 
//Map(107) {'49850' => {…}, '49851' => {…}, '49852' => {…}, '49853' => {…}, '49854' => {…}, …}
        } else if (lay !== null && lay["layer_"] !== null && lay["name_"] === clickies!["name"]+"_mesh"){
          //we also have to delete the annotation references in the corresponding mesh layer, identified by same name as annotation suffixed by _mesh 
          let sLay = lay["layer_"] as SegmentationUserLayer;
          const displayState = sLay.displayState;
          const { visibleSegments } = displayState.segmentationGroupState.value;
          let id = new Uint64();
          id.tryParseString(clickies!["id"].toString())
          visibleSegments.set(id, false);
        }
      }
    })
    //toggles visibility of a mesh 
    this.bindAction('toggle-mesh', () => {

      const clickies = this.getClickedMeshId_LayerName();
      const layers = this.layerManager.managedLayers;
      for (let lay of layers) {

        if (lay !== null && lay["layer_"] !== null && lay["name_"] === clickies!["name"]) {
          let sLay = lay["layer_"] as SegmentationUserLayer;
          const displayState = sLay.displayState;
          const { visibleSegments } = displayState.segmentationGroupState.value;
          let id = new Uint64();
          id.tryParseString(clickies!["id"].toString())
          visibleSegments.set(id, !visibleSegments.has(id));
        }
      }
    });
       //****************************cryoglancer block 5 stop 
    this.bindAction('help', () => { this.toggleHelpPanel(); });

    for (let i = 1; i <= 9; ++i) {
      this.bindAction(`toggle-layer-${i}`, () => {
        const layer = this.layerManager.getLayerByNonArchivedIndex(i - 1);
        if (layer !== undefined) {
          layer.setVisible(!layer.visible);
        }
      });
      this.bindAction(`toggle-pick-layer-${i}`, () => {
        const layer = this.layerManager.getLayerByNonArchivedIndex(i - 1);
        if (layer !== undefined) {
          layer.pickEnabled = !layer.pickEnabled;
        }
      });
      this.bindAction(`select-layer-${i}`, () => {
        const layer = this.layerManager.getLayerByNonArchivedIndex(i - 1);
        if (layer !== undefined) {
          this.selectedLayer.layer = layer;
          this.selectedLayer.visible = true;
        }
      });
    }

    for (let i = 0; i < 26; ++i) {
      const uppercase = String.fromCharCode(65 + i);
      this.bindAction(`tool-${uppercase}`, () => {
        this.activateTool(uppercase);
      });
    }

    this.bindAction('annotate', () => {

      //cryoglancer hooks into the annotation mode to draw or group. might be better to use own action for it.
      if (IMP_StateManager.getInstance().getIsDrawingMode()) {
        console.log("should draw")
      } else if (IMP_StateManager.getInstance().isGrouping()) {
        IMP_StateManager.getInstance().tryAddToGroup(this.getClickedMeshId_LayerName()!.id)
      } else {
        const selectedLayer = this.selectedLayer.layer;

        if (selectedLayer === undefined) {
          StatusMessage.showTemporaryMessage('The annotate command requires a layer to be selected.');
          return;
        }
        const userLayer = selectedLayer.layer;
        //console.log(userLayer)
        if (userLayer === null || userLayer.tool.value === undefined) {
          StatusMessage.showTemporaryMessage(`The selected layer (${JSON.stringify(selectedLayer.name)}) does not have an active annotation tool.`);
          return;
        }

        userLayer.tool.value.trigger(this.mouseState);

        //cryoglancer area mode means that we can draw a box and display the meshes/annotations within. 
        if (IMP_StateManager.getInstance().isAreaMode()) {
          console.log(userLayer.tool.value.mouseState);
          IMP_StateManager.getInstance().setCornerDrawing(userLayer.tool.value.mouseState.position);
        }
      }
    });

    //cryoglancer  draw box to define an area in which to display meshes/annotations
    this.bindAction('select-area-mode', () => {
      console.log('select Area Mode On/Off');
      IMP_StateManager.getInstance().toggleAreaMode();
      //ObjectTracker_IMP.getInstance().makeSelectionAnnotationLayer();
      console.log("Created selection layer. ")
    });


    this.bindAction('toggle-axis-lines', () => this.showAxisLines.toggle());
    this.bindAction('toggle-scale-bar', () => this.showScaleBar.toggle());
    this.bindAction('toggle-default-annotations', () => this.showDefaultAnnotations.toggle());
    this.bindAction('toggle-show-slices', () => this.showPerspectiveSliceViews.toggle());
    this.bindAction('toggle-show-statistics', () => this.showStatistics());
  }

  toggleHelpPanel() {
    this.helpPanelState.location.visible = !this.helpPanelState.location.visible;
  }

  private toolInputEventMapBinder = (inputEventMap: EventActionMap, context: RefCounted) => {
    context.registerDisposer(
      this.inputEventBindings.sliceView.addParent(inputEventMap, Number.POSITIVE_INFINITY));
    context.registerDisposer(this.inputEventBindings.perspectiveView.addParent(
      inputEventMap, Number.POSITIVE_INFINITY));
  };

  private toolBinder = this.registerDisposer(new ToolBinder(this.toolInputEventMapBinder));

  activateTool(uppercase: string) {
    this.toolBinder.activate(uppercase);
  }

  editJsonState() {
    new StateEditorDialog(this);
  }

  showStatistics(value: boolean | undefined = undefined) {
    if (value === undefined) {
      value = !this.statisticsDisplayState.location.visible;
    }
    this.statisticsDisplayState.location.visible = value;
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

     //****************************cryoglancer block 6 start

  datasets = [] as Array<any>

  //load a dataset by name
  connectToDatabase(datasetName: string) {
    IMP_dbLoader.getInstance().tryFetchByName(datasetName).then((res: any) => {
      console.log(res)
      this.loadDBsetIntoNeuroglancer(res.data)
    })
  }

  async loadDBsetIntoNeuroglancer(dataset: any) {

    IMP_dbLoader.getInstance().setDataset(dataset);
    //reset state and load new one
    this.navigationState.reset();
    this.perspectiveNavigationState.pose.orientation.reset();
    this.perspectiveNavigationState.zoomFactor.reset();
    this.resetInitiated.dispatch();


    //get the header information  
    const response = await fetch(dataset.image + "/" + dataset.name + ".json", { method: "GET" });

    //all the below defines the position and view the image should be initially loaded in. the size of the image and resolution which are stored in the "header" are used for 
    //the calculation and passed to the shaderstring to let it know what to render.
    //we are initially using some default values which will be nonsense for almost all datasets and should if everything goes right be overwritten using
    //the info from the header.
    let shaderstring = '#uicontrol invlerp normalized(clamp=false)';
    let position = [100, 100, 100]
    let dimensions = { 'x': [1, 'nm'], 'y': [1, 'nm'], 'z': [1, 'nm'] }
    if (response.ok) {
      //if a header json exists, the correct position for the normalized brightness/contrast value is used. if no file is present, best guess defaults are used, which
      //are likely not great but there are no universal defaults that would apply to any dataset.
      const headerdata = await (response.json());
      //console.log(headerdata)
      if (!(headerdata.mean === 0 && headerdata.min === 0 && headerdata.max === 0 || headerdata.max < headerdata.min)) {
        shaderstring = '#uicontrol invlerp normalized(range=[' + headerdata.min + ',' + headerdata.max + '], window=[' + (headerdata.min - Math.abs(headerdata.min)) + ',' + (headerdata.max + Math.abs(headerdata.min)) + '])'
      }
     
      position = [headerdata.x / 2, headerdata.y / 2, headerdata.z / 2];

      //console.log(Object.values(headerdata.pixel_spacing))

      if (headerdata.pixel_spacing) {
        dimensions = { 'x': [headerdata.pixel_spacing[0], 'nm'], 'y': [headerdata.pixel_spacing[1], 'nm'], 'z': [headerdata.pixel_spacing[2], 'nm'] }; //if this is in the dataset info, should be more precise

      }
    }
    //we are storing the original file describing the positions of the particles because one functionality is to download currently visible particles in the same format.
    const originalFile_response = await fetch(dataset.image + "/particles.csv");
    const originalFile = await originalFile_response.text();
    //console.log(originalFile)
    let jsonList = this.csvJSON(originalFile);
    //console.log(jsonList)
    //save the original segments, so we can download a variation from it later.
    IMP_StateManager.getInstance().setOriginalSegmentList(jsonList)
    shaderstring += '\n#uicontrol int invertColormap slider(min=0, max=1, step=1, default=0)';
    shaderstring += '\n#uicontrol vec3 color color(default="white")';
    shaderstring += '\n float inverter(float val, int invert) {return 0.5 + ((2.0 * (-float(invert) + 0.5)) * (val - 0.5));}';
    shaderstring += '\nvoid main() {\n   emitRGB(color * inverter(normalized(), invertColormap));\n}\n';
    const imgLayer = { "type": "image", "visible": true, "source": "precomputed://" + dataset.image + "/image", "tab": "rendering", "name": dataset.name, "shader": shaderstring };

    IMP_StateManager.getInstance().addLayer(imgLayer, true)


    let names = []
    let colours = []
    //add each layer to the view. They will be displayed on the left hand side of the vis and each different layer gets assigned a different colour (annotations and their
    //corresponding "meshes" layer have the same colour)
    if (dataset.layers) {
      //console.log(dataset.layers)
      for (let layer of dataset.layers) {

        /*There are two different kinds of data. One is the image along with a list of layers that were precomputed which contain the locations of annotations and meshes. These
        //are identified by lyer.type "all". The other (go down to the else) is a list of layers of type "segmentation". Each layer here was created from a segmentation map without
        //coordinational information about the location of objects, but only info about the density of objects for each layer. So this other segmentation view will have a lot 
        //of visual information and look kind of "nice" but you can only toggle each full layer and you can't select individual objects in each layer which is only of
        limited use.
        */
        if (layer && layer.type == "all") { 

          //fetch the json for the annotations 
          const response = await fetch(layer.path, { method: "GET" });

          if (!response.ok) {
            console.log("Response is not ok: " + response.json());
            continue;
          }

          let resText = await (response.text())
          let re = new RegExp('(?<=(\"|\')>)(.*?)(.json)', 'g');  //parses the resulting page for all the file names present in that folder. files ending on .json

          let sublayers = [...resText.matchAll(re)]

          let re1 = new RegExp('(?<=\>)(.*?)(.mesh)', 'g'); //files ending on .mesh
          let meshes = [...resText.matchAll(re1)]
          //console.log(meshes)
          let a = await fetch(layer.path + "columns.json", { method: "GET" }) //columns contains a list of "extra" fields by which the user may want to colour, such as cross corelation
          let columns = await (a.json());

          try {

            //create the colour by radio buttons, the default and first one is type
            let option = document.createElement("input");
            option.type = "radio";
            option.id = "color-by-type";
            option.className = "imp-radio";
            option.name = "colorBy";
            option.value = "type";
            option.checked = true;
            option.addEventListener('change', () => {
              IMP_StateManager.getInstance().updateAttribute(0);
            });

            let label = document.createElement("label");
            label.className = "imp-option-label";
            label.htmlFor = "color-by-type";
            label.innerHTML = "type";

            //label for div:
            let labDiv = document.createElement("div")
            labDiv.innerText = "Colour by:  ";
            document.getElementById('imp-color-by-div')?.appendChild(labDiv)
            document.getElementById('imp-color-by-div')?.appendChild(label);
            document.getElementById('imp-color-by-div')?.appendChild(option);

            //if any more columns are there, they get passed in here to create more radio buttons
            for (let i = 0; i < columns.length; i++) {
              let opt_ = document.createElement("input")
              opt_.type = "radio"
              opt_.id = columns[i]
              opt_.name = "colorBy"
              opt_.className = "imp-radio";
              opt_.value = columns[i]
              opt_.addEventListener('change', () => {
                IMP_StateManager.getInstance().updateAttribute(i + 1);
              });

              let label = document.createElement("label");
              label.className = "imp-option-label";
              label.htmlFor = columns[i]
              label.innerHTML = columns[i]
              document.getElementById('imp-color-by-div')?.appendChild(label)
              document.getElementById('imp-color-by-div')?.appendChild(opt_)

              //add a list of colormaps to use for colouring
              let selectEl = document.createElement("select");
              let colorMaps = IMP_StateManager.getInstance().getColormapKeys();
             
              for (let i = 0; i < colorMaps.length; i++) {
                let opt = document.createElement('option');
                if (colorMaps[i] === "jet") { opt.selected = true }
                opt.value = colorMaps[i];
                opt.textContent = colorMaps[i]
                selectEl.appendChild(opt);
              }
              //console.log(selectEl)
              document.getElementById('imp-color-by-div')?.appendChild(selectEl)
              selectEl.addEventListener('change', () => {
                IMP_StateManager.getInstance().updateColormap(selectEl.value)
              })
            }

          } catch (e) {
            console.log("Couldn't process a column file.")
          }

          //fetch each layer
          for (let sublayer of sublayers) {
            let colour = ""
            if (sublayer[0].indexOf("column") < 0) {

              const sublayerresponse = await fetch(layer.path + sublayer[0], { method: "GET" })
              const annots = await sublayerresponse.json()
         
              for (let annotation of annots) {
                IMP_StateManager.getInstance().addIdName(annotation.id, sublayer[0].split(".json")[0]);
              }
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
                "type": "annotation", "source": "local://annotations", "tab": "annotations", "name": sublayer[0].split(".json")[0],
                "shader": shaderstring,
                "annotationProperties": annotationProperties,
                "annotations": annots,
                "visible": false  //disable layer per default
              }


              names.push(sublayer[0].split(".json")[0])
              colours.push(annots[0].props[0])
              colour = annots[0].props[0]
              //console.log(newLayer)
              IMP_StateManager.getInstance().addLayer(newLayer, false)
            }

            /*try to load the mesh layer if available . Mesh layers will always have the same name as the corresponding annotation layer suffixed by _mesh*/
            for (let mesh of meshes) {

              if (mesh[1] === sublayer[0].split(".json")[0]) {
                const meshlayer = {
                  "type": "segmentation",
                  "hasAnnoConnection": true,
                  "source": {
                    "url": "precomputed://" + layer.path + mesh[0],
                    "transform": {
                      "outputDimensions": dimensions,

                      "inputDimensions": dimensions
                    }
                  },
                  "tab": "segments",
                  "segments": [],
                  "segmentDefaultColor": colour,
                  "name": sublayer[0].split(".json")[0] + "_mesh",
                  "visible": true
                };
                IMP_StateManager.getInstance().addLayer(meshlayer, false)

              }
            }
          }


        } else {

          //i'm really sorry for this partly code duplication
          const response = await fetch(layer.path, { method: "GET" });

          if (!response.ok) {
            console.log("Response is not ok: " + response.json());
            continue;
          }

          let resText = await (response.text())

          let re1 = new RegExp('(?<=\>)(.*?)(.mesh)', 'g');
          let meshes = [...resText.matchAll(re1)]

          let re2 = new RegExp('(?<=(f="))(.+)(?=(\/"))', 'g')
          let segmentationLayers = [...resText.matchAll(re2)]

          //console.log(segmentationLayers)
          //define some colours. They are supposed to be easily distinguishable from one another.
          const colors = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000']
          let counter = 0;
          for (const el of segmentationLayers) {

            if (el[0] === "..") { //the segmentationLayers list will contain everything in the layer folder including ".."  which is of no use for us
              continue;
            }
       
            const segmentationlayer = {
              "type": "segmentation",
              "source": {
                "url": "precomputed://" + layer.path + "/" + el[0],
                "transform": {
                  "outputDimensions": dimensions,

                  "inputDimensions": dimensions
                }
              },
              "tab": "rendering",
              "saturation": 0.7,
              "name": el[0],
              "segmentDefaultColor": colors[counter],
              "visible": true
            }
            counter++;
            IMP_StateManager.getInstance().addLayer(segmentationlayer, false)
          }

          //console.log(segmentationLayers)
          for (let mesh of meshes) {
            const meshlayer = {
              "type": "segmentation",
              //"hasAnnoConnection": false,
              "source": {
                "url": "precomputed://" + layer.path + mesh[0],
                "transform": {
                  "outputDimensions": dimensions,

                  "inputDimensions": dimensions
                }
              },
              "tab": "rendering",
              "saturation": 0.7,
              "segments": [],
              "segmentDefaultColor": "darkblue",
              "name": mesh[0],
              "visible": true
            };
            IMP_StateManager.getInstance().addLayer(meshlayer, false)


          }


        }
      }

      IMP_StateManager.getInstance().setState(this.state);
      IMP_StateManager.getInstance().setPosAndDim(position, dimensions)
      IMP_StateManager.getInstance().makeStateJSON();



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


        if (dataset.proteomics && dataset.proteomics.path) {
          let protTable = document.createElement("table")
          protTable.className = "proteomics-table"

          responseElement.append(protTable)


          let hasHead = false;
          const response = await fetch(dataset.proteomics.path, { method: "GET" });
          const res = await response.json();

          const keys = []
          for (const item of res) {
            //fill the header row with the keys in the table
            if (!hasHead) {
              //trEl_head.innerHTML = ''; //reset table
              for (const key of Object.keys(item)) {
                let tdEl = document.createElement("div")
                tdEl.textContent = key
                tdEl.className = "proteomics-table-head-item"
                protTable.append(tdEl)
                keys.push(key)
              }
              hasHead = true;
            }
            for (const key of keys) {
              let tdEl1_ = document.createElement("div")
              tdEl1_.textContent = item[key]
              tdEl1_.title = item[key];
              protTable.append(tdEl1_)
            }
          }
        } else {
          //console.log("no proteomics")
          responseElement.textContent = "No Proteomics data found."
        }
        responseElement.style.display = "none"
        //console.log(responseElement)
      }

    }
  }

  //copy pasted function to create a JSON from a csv
  csvJSON(csv: string) {

    let lines = csv.split("\n");

    let result = [];

    // NOTE: If your columns contain commas in their values, you'll need
    // to deal with those before doing the next step 
    // (you might convert them to &&& or something, then covert them back later)
    // jsfiddle showing the issue https://jsfiddle.net/
    //console.log(lines)
    let headers = lines[0].split(",");

    for (let i = 1; i < lines.length; i++) {

      let obj: any;
      obj = {}
      let currentline = lines[i].split(",");

      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = currentline[j];

      }
      result.push(obj);
    }

    //return result; //JavaScript object
    return JSON.stringify(result); //JSON
  }

  getClassNamePerType(typ: string) {
    let className = "";

    switch (typ) {
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
//cryoglancer *********************************** block 6 stop
}
