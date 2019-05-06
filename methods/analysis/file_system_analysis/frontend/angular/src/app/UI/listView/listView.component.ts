import {Component, EventEmitter, Input, Output, ViewChild, ElementRef} from '@angular/core';
import {MatDialog} from '@angular/material';

import {SelectionModel} from '@angular/cdk/collections';
import {SelectDialogComponent} from '../dialog/select-dialog/select-dialog.component';
import {Subject} from 'rxjs';
import 'rxjs/add/observable/of';
import {VirtualArrayModel} from '../../models/virtualArray.model';
import {ClusterModel} from '../../models/cluster.model';
import {TextSelectEvent, SelectionRectangle} from '../text-select.directive';
import {FilterModel} from '../../models/filter.model';
import * as lodash from 'lodash';
import {VirtualScrollerComponent} from 'ngx-virtual-scroller';
import {ToastrService} from 'ngx-toastr';
import {debounceTime} from 'rxjs/operators';
import {ClusterService} from '../../services/cluster.service';
import {DataModel} from '../../models/data.model';
import {BaseService} from '../../services/base.service';

@Component({
    selector: 'app-list-view',
    templateUrl: './listView.component.html',
    styleUrls: ['./listView.component.css']
})
export class ListViewComponent {

    @Input('case')
    case: string;
    @Input('filter')
    filter: string;
    @Input('clusters')
    clusters: ClusterModel[] = [];
    oldClusters: ClusterModel[] = [];

    @Output('makeManualCluster')
    makeManualCluster: EventEmitter<ClusterModel> = new EventEmitter<ClusterModel>();
    @Output('additionalFiltersChanged')
    additionalFiltersChanged: EventEmitter<Map<string, string>> = new EventEmitter<Map<string, string>>();
    @Output('actualScrollPosition')
    actualScrollPosition: EventEmitter<[number, number, string, string]> = new EventEmitter<[number, number, string, string]>();
    @Output('setFromBoundary')
    setFromBoundary: EventEmitter<Date> = new EventEmitter<Date>();
    @Output('setToBoundary')
    setToBoundary: EventEmitter<Date> = new EventEmitter<Date>();

    tablePanelOpenState = true;
    searchString = '';
    additionalFilters: Map<string, string> = new Map<string, string>();
    selected_rows_id: Set<string> = new Set<string>();
    tableSelection = new SelectionModel<any>(true, []);
    availableTableColumns = [
        'select',
        'doctype',
        'timestamp',
        'size',
        'type',
        'mode',
        'uid',
        'gid',
        'inode',
        'name',
        'M-Time',
        'A-Time',
        'C-Time',
        'B-Time',
        'id'
    ];
    displayedTableColumns = ['select', 'timestamp', 'size', 'type', 'mode', 'uid', 'gid', 'name'];
    pageSortString = 'timestamp';
    pageSortOrder = 'asc';
    // data
    total = 0;
    data: any[];
    timestampColor = {colors: ['#f0f0f0', '#ffffff'], colored_nodes: new Map<string, string>()};  //'#fceada'
    // skipping
    public highlightedTextBox: SelectionRectangle | null;
    highlightedText: string;
    highlightedTextId: number;
    public highlightedTextDateBox: SelectionRectangle | null;
    highlightedTextDate: string;
    highlightedTextDateId: number;
    // pagination
    page_number = 1;
    page_size = 1500000;
    // Virtual scroll
    @ViewChild(VirtualScrollerComponent) virtualScroller: VirtualScrollerComponent;
    virtualArray: VirtualArrayModel = new VirtualArrayModel();
    preloadedBufferSize = 4000; // buffer window size - minimum = (2*preloadBufferBorder) + preloadBufferOffset
    preloadBufferOffset = 1200; // shift of buffer window - should be bigger than preloadBufferBorder
    preloadBufferBorder = 1000; // when to trigger buffer shift (to the end of buffer window)
    skipBufferSize = 50000;
    private dataLoaderDebouncer: Subject<[number, number, number, number, boolean, boolean]> = new Subject();
    listViewScrollHeight = 10;
    visibleData: any[] = [];
    preloadedData: any[] = [];
    preloadedBegin = 0;
    preloadedEnd;
    // preloadVisibleStart = 0;
    preloadBufferState = false;
    visibleDataFirstIndex = 0;
    visibleDataLastIndex = 0;
    loadingData = false;
    skippingData = null;

    @ViewChild('highlightedBox') highlightedBox: ElementRef;
    @ViewChild('highlightedDateBox') highlightedDateBox: ElementRef;

    constructor(private clusterService: ClusterService,
                private baseService: BaseService,
                public dialog: MatDialog,
                private toaster: ToastrService) {
        this.dataLoaderDebouncer.pipe(
            debounceTime(300))
            .subscribe((value) => this.dataLoader(
                value[0], value[1], value[2], value[3], value[4], value[5])
            );
        this.total = 0;
        this.highlightedTextBox = null;
        this.highlightedText = '';
        this.highlightedTextDateBox = null;
        this.highlightedTextDate = '';
    }

    /**
     * Initializes list asynchronously
     * @returns {Promise<void>}
     */
    async init() {
        this.loadingData = true;
        // this.clusterManager.additional_filters = Array.from(this.additionalFilters.values());
        // this.clusterManager.case = this.case;
        // this.clusterManager.clusters = this.clusters;
        // const shift = await this.clusterManager.getDifferenceShift(this.oldClusters, this.visibleDataFirstIndex, this.visibleData[0]);
        const shift = await this.clusterService.getDifferenceShift(
            this.case,
            this.clusters,
            this.oldClusters,
            this.visibleDataFirstIndex,
            this.visibleData[0]);
        // const shift = 0;
        // const loadEvent = {};
        // loadEvent['start'] = this.visibleDataFirstIndex;
        // loadEvent['end'] = this.visibleDataLastIndex === 0 ? (this.visibleDataFirstIndex + 20) : this.visibleDataLastIndex;
        // this.loadVisibleData(loadEvent);
        // let size = this.visibleDataLastIndex - this.visibleDataFirstIndex + 1;
        // if (size === 0) {
        //     size = 20;
        // }
        const initSize = 200;
        // const resp = await this.clusterManager.getData(this.visibleDataFirstIndex, initSize, this.pageSortString, this.pageSortOrder);
        const resp = await this.clusterService.getData(this.case,
            this.clusters,
            Array.from(this.additionalFilters.values()),
            this.visibleDataFirstIndex,
            initSize,
            this.pageSortString,
            this.pageSortOrder).catch(
            () => {
                this.toaster.error('Cannot load data', 'Loading failed');
                this.loadingData = false;
                return new DataModel;
            });
        console.log('list data loaded async', resp, resp.data, resp.total);
        this.data = resp.data;
        this.total = resp.total;
        this.preloadedData = resp.data;
        this.preloadedBegin = this.visibleDataFirstIndex;
        this.preloadedEnd = this.visibleDataFirstIndex + initSize;
        if (this.total > this.page_size) {
            if (this.page_number * this.page_size > this.total) {
                this.virtualArray.length = this.total - ((this.page_number - 1) * this.page_size);
            } else {
                this.virtualArray.length = this.page_size;
            }
        } else {
            this.virtualArray.length = this.total;
        }
        this.loadingData = false;
        this.visibleData = this.data;
        if (this.visibleDataFirstIndex + shift > this.total ) {
            this.scrollToIndex(this.total);
        } else {
            this.scrollToIndex(this.visibleDataFirstIndex + shift);
        }
        // this.virtualScroller.refresh();

        // this.clusterManager.getData(this.visibleDataFirstIndex, initSize, this.pageSortString, this.pageSortOrder)
        //     .then(resp => {
        //         console.log('list data loaded async', resp, resp.data, resp.total);
        //         this.data = resp.data;
        //         this.total = resp.total;
        //         this.preloadedData = resp.data;
        //         this.preloadedBegin = this.visibleDataFirstIndex;
        //         this.preloadedEnd = this.visibleDataFirstIndex + initSize;
        //         this.virtualArray.length = this.total;
        //         this.loadingData = false;
        //         this.visibleData = this.data;
        //         if (this.visibleDataFirstIndex + shift > this.total ) {
        //             this.scrollToIndex(this.total - 20 < 0 ? 0 : this.total - 20);
        //         } else {
        //             this.scrollToIndex(this.visibleDataFirstIndex + shift);
        //         }
        //         // this.virtualScroller.refresh();
        //     });
        // this.virtualScroller.scrollToIndex(this.visibleDataFirstIndex + shift);
        this.oldClusters = lodash.cloneDeep(this.clusters);
        // this.virtualScroller.refresh();
    }

    isAllSelected() {
        const numSelected = this.tableSelection.selected.length;
        const numRows = this.data.length;
        return numSelected >= numRows;
    }

    /** Selects all rows if they are not all selected; otherwise clear selection. */
    masterToggle() {
        this.isAllSelected() ?
            this.tableSelection.clear() :
            this.data.forEach(row => this.tableSelection.select(row));
    }

    tableSort($event) {
        console.log($event);
        let pageSort = $event['active'];
        if (pageSort === 'M Time' || pageSort === 'A Time' || pageSort === 'C Time' || pageSort === 'B Time') {
            pageSort = 'timestamp';
        }
        if ($event['direction'] !== '' && pageSort !== '') {
            this.pageSortString = pageSort;
            this.pageSortOrder = $event['direction'];
        } else {
            this.pageSortString = 'timestamp';
            this.pageSortOrder = 'asc';
        }
        this.init();
    }

    /**
     * Filters data by search string
     */
    searchByString() {
        console.log('search', this.searchString);
        if (this.searchString !== '') {
            this.additionalFilters.set('searchString', this.baseService.buildAdditionSearchFilter(this.searchString));
            this.init();
        } else if (this.additionalFilters.has('searchString')) {
            this.additionalFilters.delete('searchString');
            this.init();
        }
        this.additionalFiltersChanged.emit(this.additionalFilters);
    }

    /**
     * Filters data by Date
     * @param {string} from Date
     * @param {string} to Date
     */
    timeRangeFilter(from: string, to: string) {
        console.log('time range filter: from:', from, 'to:', to);
        if (from != null || to != null) {
            if (from !== undefined || to !== undefined) {
                this.additionalFilters.set('timeRange', this.baseService.buildAdditionRangeFilter(from, to));
                this.init();
            }
        }
        this.additionalFiltersChanged.emit(this.additionalFilters);
    }

    /**
     * Filters data in view by metadata types
     * @param types
     */
    typeFilter(types) {
        console.log('type filter:', types);
        if (types != null) {
            if (types !== undefined) {
                this.additionalFilters.set('typeFilter',
                    this.baseService.buildAdditionMactimeTypeFilter(Array.from(types)));
                this.init();
            }
        }
        this.additionalFiltersChanged.emit(this.additionalFilters);
    }

    /**
     * Opens dialog to edit visible table columns
     */
    editTableColumns() {
        const dialogRef = this.dialog.open(SelectDialogComponent, {
            width: '350px',
            height: '90%',
            data: {
                title: 'Select table columns',
                available: this.availableTableColumns,
                selected: this.displayedTableColumns
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result != null) {
                console.log(result);
                this.displayedTableColumns = result;
                // this.displayedTableColumns = ['name'];
            }
        });
    }

    showScroll($event) {
        // console.log($event);
        // console.log(this.scrollbar.autoPropagation);
        // console.log(this.scrollbar.states);
        // console.log($event.target.offsetHeight);
        // console.log($event.target.scrollTop);
        // const thumb = document.getElementById('interactive-table-scroll').getElementsByClassName('ps__thumb-y')[0] as HTMLElement;
        // thumb.style.height = '10px';
        // console.log(thumb.clientHeight);
    }

    /**
     * Method called by virtual scroll to get visible data from database or preloaded buffer.
     * @param $event Virtual scroll event
     */
    loadVisibleData($event) {
        // console.log($event);
        const start = $event['startIndex'];
        const end = $event['endIndex'];
        // console.log('visible start index:', this.visibleDataFirstIndex);
        this.visibleDataFirstIndex = start < 0 ? 0 : start;
        this.visibleDataLastIndex = end < 0 ? 0 : end;
        if (this.virtualArray.length > 0) { // get rid of fake loading state if empty
            if (end <= this.preloadedEnd && start >= this.preloadedBegin) {
                this.visibleData = this.preloadedData.slice(
                    (start - this.preloadedBegin),
                    (end - (this.preloadedBegin) + 1)
                );
                this.actualScrollPosition.emit(
                    [
                        start, end, this.visibleData[0]['_source']['@timestamp'], this.visibleData[end - start]['_source']['@timestamp']
                    ]);
                if ((start - this.preloadedBegin < this.preloadBufferBorder) && (start > this.preloadBufferBorder)) {
                    // console.log('start border triggered',
                    //     'start:', start,
                    //     'preload begin:', this.preloadedBegin,
                    //     'buffer border:', this.preloadBufferBorder);
                    const begVal = start - this.preloadBufferOffset < 0 ? 0 : start - this.preloadBufferOffset;
                    this.preloadData(begVal, this.preloadedBufferSize, null, null, false, true);
                }
                if (this.preloadedEnd - end < this.preloadBufferBorder && this.preloadedEnd < this.total) {
                    // console.log('end border triggered',
                    //     'end:', end,
                    //     'preload end:', this.preloadedEnd,
                    //     'buffer border:', this.preloadBufferBorder);
                    const begVal = start - this.preloadBufferOffset < 0 ? 0 : start - this.preloadBufferOffset;
                    this.preloadData(begVal, this.preloadedBufferSize, null, null, false, true);
                }
            } else {
                if (end > this.preloadedEnd) {
                    const begVal = end - (this.preloadedBufferSize - this.preloadBufferOffset) < 0 ? 0 : end - (this.preloadedBufferSize - this.preloadBufferOffset);
                    this.preloadData(begVal, this.preloadedBufferSize, start, end, true, false);
                } else {
                    const begVal = start - this.preloadBufferOffset < 0 ? 0 : start - this.preloadBufferOffset;
                    this.preloadData(begVal, this.preloadedBufferSize, start, end, true, false);
                }
            }
        }
    }

    /**
     * Method called to preload data to buffer for virtual scroll.
     * @param begin Offset of loading data
     * @param size Size of loading data
     * @param visibleDataStart Start index of displayed data
     * @param visibleDataEnd end index of displayed data
     * @param {boolean} loadingState If true then loading bar is visible
     * @param {boolean} preloadBuffer If true then preloading is triggered
     */
    preloadData(begin, size, visibleDataStart, visibleDataEnd, loadingState: boolean, preloadBuffer: boolean) {
        if (!this.preloadBufferState && preloadBuffer) {
            console.log('calling data preload');
            this.preloadBufferState = true;
            this.dataLoader(begin, size, visibleDataStart, visibleDataEnd, loadingState, preloadBuffer);
        } else if (!preloadBuffer) {
            this.dataLoaderDebouncer.next([begin, size, visibleDataStart, visibleDataEnd, loadingState, preloadBuffer]);
        }

    }

    /**
     * Method called to load data from database into buffer.
     * @param begin Offset of loading data
     * @param size Size of loading data
     * @param visibleDataStart Start index of displayed data
     * @param visibleDataEnd end index of displayed data
     * @param {boolean} loadingState If true then loading bar is visible
     * @param {boolean} preloadBuffer If true then preloading is triggered
     */
    dataLoader(begin, size, visibleDataStart, visibleDataEnd, loadingState: boolean, preloadBuffer: boolean) {
        if (loadingState) {
            this.loadingData = true;
        }
        let begin_with_page = begin + ((this.page_number - 1) * this.page_size);
        if (begin_with_page < 0) {
            begin_with_page = 0;
        }
        // this.clusterManager.getData(begin_with_page, size, this.pageSortString, this.pageSortOrder)
        this.clusterService.getData(
            this.case,
            this.clusters,
            Array.from(this.additionalFilters.values()),
            begin_with_page,
            size,
            this.pageSortString,
            this.pageSortOrder)
            .then(resp => {
                console.log('virtual scroll loaded data', resp, resp.data, resp.total,
                    'from: ', begin, '(from + page index):', begin_with_page, 'size: ', size);
                this.preloadedData = resp.data;
                this.preloadedBegin = begin;
                this.preloadedEnd = this.preloadedBegin + size;
                if (visibleDataStart != null && visibleDataEnd != null) {
                    this.visibleData = this.preloadedData.slice(
                        (visibleDataStart - this.preloadedBegin),
                        (visibleDataEnd - (this.preloadedBegin) + 1)
                    );
                }
                this.virtualScroller.refresh();
            },
            () => {
                this.toaster.error('Cannot load data', 'Loading failed');
                this.loadingData = false;
            }).then(() => {
            console.log('Preload data - done!');
            if (loadingState) {
                this.loadingData = false;
            }
            if (preloadBuffer) {
                this.preloadBufferState = false;
            }
        });
    }

    /**
     * Add item with given id to selection
     * @param id Id of item in database
     */
    tableSelect(id) {
        if (this.selected_rows_id.has(id)) {
            this.selected_rows_id.delete(id);
        } else {
            this.selected_rows_id.add(id);
        }
    }

    selectionExists() {
        return window.getSelection().toString();
    }

    /**
     * Opens context menu after highlighting some text (mouse selection)
     * @param {TextSelectEvent} event
     * @param index Index of item in list
     */
    openHighlightedTextMenu(event: TextSelectEvent, index) {
        console.log(index);
        console.log(window.getSelection());
        console.group('Text Select Event');
        console.log('Text:', event.text);
        console.log('Viewport Rectangle:', event.viewportRectangle);
        console.log('Host Rectangle:', event.hostRectangle);
        console.groupEnd();
        this.highlightedTextId = index + this.visibleDataFirstIndex;
        if (event.hostRectangle) {

            this.highlightedTextBox = event.hostRectangle;
            this.highlightedText = event.text;
            this.highlightedBox.nativeElement.style.display = 'block';
            this.highlightedBox.nativeElement.style.top = (event.viewportRectangle.top - 35) + 'px';
            this.highlightedBox.nativeElement.style.left = event.viewportRectangle.left + 'px';

        } else {
            this.highlightedBox.nativeElement.style.display = 'none';
            this.highlightedTextBox = null;
            this.highlightedText = '';

        }
    }

    /**
     * Opens context menu after highlighting timestamp (mouse selection)
     * @param {TextSelectEvent} event
     * @param index Index of item in list
     */
    openHighlightedTextDateMenu(event: TextSelectEvent, index) {
        console.group('Text Select Date Event');
        console.log('Text:', event.text);
        console.log('Viewport Rectangle:', event.viewportRectangle);
        console.log('Host Rectangle:', event.hostRectangle);
        console.groupEnd();
        this.highlightedTextDateId = index + this.visibleDataFirstIndex;
        if (event.hostRectangle) {

            this.highlightedTextDateBox = event.hostRectangle;
            this.highlightedTextDate = event.text;
            this.highlightedDateBox.nativeElement.style.display = 'block';
            this.highlightedDateBox.nativeElement.style.top = (event.viewportRectangle.top - 35) + 'px';
            this.highlightedDateBox.nativeElement.style.left = event.viewportRectangle.left + 'px';

        } else {
            this.highlightedDateBox.nativeElement.style.display = 'none';
            this.highlightedTextDateBox = null;
            this.highlightedTextDate = '';

        }
    }

    /**
     * Creates filter by highlighted prefix (mouse selection)
     */
    makeClusterByHighlight(): void {
        console.log('text', this.highlightedText);
        const cluster = new ClusterModel();
        cluster.name = this.highlightedText;
        cluster.color = '#3d9fea';
        const filter = new FilterModel();
        filter.json = this.baseService.buildAdditionSearchFilter(this.highlightedText);
        filter.isSelected = true;
        filter.name = 'highlighted_text';
        filter.type = 'REGEX';
        cluster.filters.push(filter);
        // computation.filters.add(filter);
        this.makeManualCluster.emit(cluster);
    }

    /**
     * Skips (scrolls) the block by highlighted prefix (mouse selection) of File Name
     * @param {boolean} toTheEnd If true then skip to the end of the block else skip to the start
     */
    async skipTheBlockByHighlightedFileName(toTheEnd: boolean) {
        const hideEvent: TextSelectEvent = {text: ' ', viewportRectangle: null, hostRectangle: null};
        if (this.skippingData) {
            console.log('already skipping this block =>', this.skippingData);
            this.toaster.error('Skipping: ' + this.skippingData, 'You are already skipping');
            this.openHighlightedTextMenu(hideEvent, 0);
            return;
        }
        console.log('skip File Name from', this.highlightedTextId, this.visibleDataFirstIndex, this.preloadedBegin);
        let skipIndex = null;
        const skipFrom = this.highlightedTextId;
        let test = this.highlightedText;
        let index_start = (this.highlightedTextId - this.preloadedBegin);
        test = test.replace('/', '\\/')
            .replace('.', '\\.')
            .replace('-', '\\-')
            .replace('(', '\\(')
            .replace(')', '\\)')
            .replace('[', '\\[')
            .replace(']', '\\]')
            .replace('*', '\\*')
            .replace('+', '\\+')
            .replace('{', '\\{')
            .replace('}', '\\}')
            .replace('^', '\\^')
            .replace('?', '\\?')
            .replace('<', '\\<')
            .replace('>', '\\>')
            .replace('&', '\\&')
            .replace('$', '\\$')
            .replace('|', '\\|');
        test += '.*';
        test = '^' + test;
        const regex = new RegExp(test);
        console.log('skipping File Name by regex prefix: ', regex);
        this.skippingData = this.highlightedText;

        if (toTheEnd) {
            index_start += 1;
        } else {
            index_start -= 1;
        }

        let bufferSize = this.preloadedBufferSize;
        let bufferOffset = this.preloadedBegin + ((this.page_number - 1) * this.page_size);
        let buffer = this.preloadedData;

        while (skipIndex == null) {
            skipIndex = this.skipFileNameBlock(regex, index_start, buffer, bufferOffset, bufferSize, toTheEnd);
            if (skipIndex == null) {
                if (toTheEnd) {
                    index_start = 0;
                    bufferOffset = bufferSize + bufferOffset;
                    bufferSize = this.skipBufferSize;
                    // const res = await this.clusterManager.getData(bufferOffset, bufferSize,  this.pageSortString, this.pageSortOrder);
                    const res = await this.clusterService.getData(
                        this.case,
                        this.clusters,
                        Array.from(this.additionalFilters.values()),
                        bufferOffset,
                        bufferSize,
                        this.pageSortString,
                        this.pageSortOrder);
                    buffer = res.data;
                } else {
                    index_start = (bufferSize - 1);
                    bufferOffset = bufferOffset - bufferSize >= 0 ? bufferOffset - bufferSize : 0;
                    bufferSize = this.skipBufferSize;
                    // const res = await this.clusterManager.getData(bufferOffset, bufferSize,  this.pageSortString, this.pageSortOrder);
                    const res = await this.clusterService.getData(
                        this.case,
                        this.clusters,
                        Array.from(this.additionalFilters.values()),
                        bufferOffset,
                        bufferSize,
                        this.pageSortString,
                        this.pageSortOrder);
                    buffer = res.data;
                }
            }
        }
        // We want to see last entry of skipped block
        if (toTheEnd) {
            skipIndex -= 1;
        }
        console.log('skip File Name to:', skipIndex + bufferOffset);
        this.scrollToIndex(skipIndex + bufferOffset);
        this.skippingData = null;
        let skippedItems = skipIndex + bufferOffset - skipFrom;
        if (skippedItems < 0) {
            skippedItems = skippedItems * (-1);
        }
        this.toaster.success(skippedItems.toString(10) + (skippedItems > 1 ? ' items' : ' item'), 'You skipped');
        this.openHighlightedTextMenu(hideEvent, 0);
    }

    /**
     * Skips File Name in given buffer by given prefix regex
     * @param prefixRegex Prefix regex of File Name
     * @param startIndex Index to starts with
     * @param buffer Data to skip
     * @param bufferOffset Offset of buffer from the first item
     * @param bufferSize Size of loaded buffer
     * @param {boolean} toTheEnd If true then skip to the end of the block else skip to the start
     * @returns {any} null if nothing was found, position to skip to otherwise
     */
    skipFileNameBlock (prefixRegex, startIndex, buffer, bufferOffset, bufferSize, toTheEnd: boolean) {
        let skipIndex = null;
        if (toTheEnd) {
            for (let index = startIndex; index < buffer.length; index++) {
                if (prefixRegex.test(buffer[index]._source['File Name']) === false) {
                    skipIndex = index;
                    break;
                }
            }
        } else {
            for (let index = startIndex; index >= 0; index--) {
                if (prefixRegex.test(buffer[index]._source['File Name']) === false) {
                    skipIndex = index;
                    break;
                }
            }
        }
        if (bufferOffset === 0 && skipIndex == null && !toTheEnd) {
            return 0;
        }
        if (buffer.length < bufferSize && skipIndex == null && toTheEnd) {
            return buffer.length;
        }
        return skipIndex;
    }

    /**
     * Parse date from highlighted part of timestamp field
     * @returns {{dateString: string; dateLevel: number}} dateString represents date in format yyyy-mm-dd HH:mm:ss
     *                                                    dateLevel represents depth of highlighted part of timestamp ( 0 - only year, 1 - year and month, etc.)
     */
    parseDateFromHighlight() {
        let dateLevel = 0;
        for (let i = 0; i < this.highlightedTextDate.length; i++) {
            if (this.highlightedTextDate[i] === '-' || this.highlightedTextDate[i] === ' ' || this.highlightedTextDate[i] === ':') {
                dateLevel += 1;
            }
        }

        let dateString = this.highlightedTextDate;
        if (dateLevel === 3) {
            dateString += ':00';
        }
        if (dateLevel === 2) {
            dateString += ' 00:00';
        }
        if (dateLevel === 1) {
            dateString += '-01 00:00';
        }
        if (dateLevel === 0) {
            dateString += '-01-01 00:00';
        }
        return {'dateString': dateString, 'dateLevel': dateLevel};
    }

    /**
     * Skips (scrolls) the block by highlighted timestamp (mouse selection)
     * @param {boolean} toTheEnd If true then skip to the end of the block else skip to the start
     */
    async skipTheBlockByDate(toTheEnd: boolean) {
        const hideEvent: TextSelectEvent = {text: ' ', viewportRectangle: null, hostRectangle: null};
        if (this.skippingData) {
            console.log('already skipping this block =>', this.skippingData);
            this.toaster.error('Skipping: ' + this.skippingData, 'You are already skipping');
            this.openHighlightedTextDateMenu(hideEvent, 0);
            return;
        }
        console.log('skip date from', this.highlightedTextDateId, this.visibleDataFirstIndex, this.preloadedBegin);
        let skipIndex = null;
        const skipFrom = this.highlightedTextDateId;
        // let dateLevel = 0;
        // for (let i = 0; i < this.highlightedTextDate.length; i++) {
        //     if (this.highlightedTextDate[i] === '-' || this.highlightedTextDate[i] === ' ' || this.highlightedTextDate[i] === ':') {
        //         dateLevel += 1;
        //     }
        // }
        //
        // let dateString = this.highlightedTextDate;
        // if (dateLevel === 3) {
        //     dateString += ':00';
        // }
        const parsedDate = this.parseDateFromHighlight();
        const dateString = parsedDate.dateString;
        const dateLevel = parsedDate.dateLevel;
        console.log('skipping date', this.highlightedTextDate);
        this.skippingData = dateString;
        const selectedDate = new Date(dateString);
        let index_start = (this.highlightedTextDateId - this.preloadedBegin);

        if (toTheEnd) {
            index_start += 1;
        } else {
            index_start -= 1;
        }

        let bufferSize = this.preloadedBufferSize;
        let bufferOffset = this.preloadedBegin + ((this.page_number - 1) * this.page_size);
        let buffer = this.preloadedData;

        while (skipIndex == null) {
            skipIndex = this.skipDateBlock(selectedDate, dateLevel, index_start, buffer, bufferOffset, bufferSize, toTheEnd);
            if (skipIndex == null) {
                if (toTheEnd) {
                    index_start = 0;
                    bufferOffset = bufferSize + bufferOffset;
                    bufferSize = this.skipBufferSize;
                    // const res = await this.clusterManager.getData(bufferOffset, bufferSize,  this.pageSortString, this.pageSortOrder);
                    const res = await this.clusterService.getData(
                        this.case,
                        this.clusters,
                        Array.from(this.additionalFilters.values()),
                        bufferOffset,
                        bufferSize,
                        this.pageSortString,
                        this.pageSortOrder);
                    buffer = res.data;
                } else {
                    index_start = (bufferSize - 1);
                    bufferOffset = bufferOffset - bufferSize >= 0 ? bufferOffset - bufferSize : 0;
                    bufferSize = this.skipBufferSize;
                    // const res = await this.clusterManager.getData(bufferOffset, bufferSize,  this.pageSortString, this.pageSortOrder);
                    const res = await this.clusterService.getData(
                        this.case,
                        this.clusters,
                        Array.from(this.additionalFilters.values()),
                        bufferOffset,
                        bufferSize,
                        this.pageSortString,
                        this.pageSortOrder);
                    buffer = res.data;
                }
            }
        }
        // We want to see last entry of skipped block
        if (toTheEnd) {
            skipIndex -= 1;
        }
        console.log('skip date to:', skipIndex + bufferOffset);
        this.scrollToIndex(skipIndex + bufferOffset);
        this.skippingData = null;
        let skippedItems = skipIndex + bufferOffset - skipFrom;
        if (skippedItems < 0) {
            skippedItems = skippedItems * (-1);
        }
        this.toaster.success(skippedItems.toString(10) + (skippedItems > 1 ? ' items' : ' item'), 'You skipped');
        this.openHighlightedTextDateMenu(hideEvent, 0);
    }

    /**
     * Skips Date in given buffer
     * @param selectedDate Date to skip
     * @param dateLevel Depth of datetime. (0-years, 1-months, etc.)
     * @param startIndex Index to starts with
     * @param buffer Data to skip
     * @param bufferOffset Offset of buffer from the first item
     * @param bufferSize Size of loaded buffer
     * @param {boolean} toTheEnd If true then skip to the end of the block else skip to the start
     * @returns {any} null if nothing was found, position to skip to otherwise
     */
    skipDateBlock(selectedDate, dateLevel, startIndex, buffer, bufferOffset, bufferSize, toTheEnd: boolean) {
        let skipIndex = null;
        if (toTheEnd) {
            for (let index = startIndex; index < buffer.length; index++) {
                const next_date = new Date(buffer[index]._source['@timestamp']);
                if (dateLevel >= 0) {
                    if (selectedDate.getFullYear() < next_date.getUTCFullYear()) {
                        skipIndex = index;
                        break;
                    }
                }
                if (dateLevel >= 1) {
                    if (selectedDate.getMonth() < next_date.getUTCMonth()) {
                        skipIndex = index;
                        break;
                    }
                }
                if (dateLevel >= 2) {
                    if (selectedDate.getDate() < next_date.getUTCDate()) {
                        skipIndex = index;
                        break;
                    }
                }
                if (dateLevel >= 3) {
                    if (selectedDate.getHours() < next_date.getUTCHours()) {
                        skipIndex = index;
                        break;
                    }
                }
                if (dateLevel >= 4) {
                    if (selectedDate.getMinutes() < next_date.getUTCMinutes()) {
                        skipIndex = index;
                        break;
                    }
                }
                if (dateLevel >= 5) {
                    if (selectedDate.getSeconds() < next_date.getUTCSeconds()) {
                        skipIndex = index;
                        break;
                    }
                }
            }
        } else {
            for (let index = startIndex; index >= 0; index--) {
                const next_date = new Date(buffer[index]._source['@timestamp']);
                if (dateLevel >= 0) {
                    if (selectedDate.getFullYear() > next_date.getUTCFullYear()) {
                        skipIndex = index;
                        break;
                    }
                }
                if (dateLevel >= 1) {
                    if (selectedDate.getMonth() > next_date.getUTCMonth()) {
                        skipIndex = index;
                        break;
                    }
                }
                if (dateLevel >= 2) {
                    if (selectedDate.getDate() > next_date.getUTCDate()) {
                        skipIndex = index;
                        break;
                    }
                }
                if (dateLevel >= 3) {
                    if (selectedDate.getHours() > next_date.getUTCHours()) {
                        skipIndex = index;
                        break;
                    }
                }
                if (dateLevel >= 4) {
                    if (selectedDate.getMinutes() > next_date.getUTCMinutes()) {
                        skipIndex = index;
                        break;
                    }
                }
                if (dateLevel >= 5) {
                    if (selectedDate.getSeconds() > next_date.getUTCSeconds()) {
                        skipIndex = index;
                        break;
                    }
                }
            }
        }
        if (bufferOffset === 0 && skipIndex == null && !toTheEnd) {
            return 0;
        }
        if (buffer.length < bufferSize && skipIndex == null && toTheEnd) {
            return buffer.length;
        }
        return skipIndex;
    }

    /**
     * Sets actual highlighted part of timestamp field as "from" date boundary
     */
    setDateAsFromField() {
        const parsedDate = this.parseDateFromHighlight();
        const date = new Date(parsedDate.dateString);
        const UTCDateTime = new Date(new Date(date).getTime() - new Date(date).getTimezoneOffset() * 60000);
        this.setFromBoundary.emit(UTCDateTime);
    }

    /**
     * Sets actual highlighted part of timestamp field as "to" date boundary
     */
    setDateAsToField() {
        const parsedDate = this.parseDateFromHighlight();
        const date = new Date(parsedDate.dateString);
        const UTCDateTime = new Date(new Date(date).getTime() - new Date(date).getTimezoneOffset() * 60000);
        this.setToBoundary.emit(UTCDateTime);
    }

    /**
     * Select the part of path on the left by clicking to the filename
     *
     * for example /home/ab(click)cd/eef/
     * then /home/abcd is selected
     *
     * @param index
     */
    selectByClick(index) {
        const selection = window.getSelection();
        const offset = window.getSelection().anchorOffset;
        const data = window.getSelection().anchorNode['data'];
        const length = selection.toString().length;

        const range = selection.getRangeAt(0);
        const node = selection.anchorNode;

        range.setStart(node, 0);
        if (length === 0) {
            let subString = '';
            for (let i = offset; i < data.length; i++) {
                if (data[i] === '/' || data[i] === ' ') {
                    // Take it from index one because on index zero is now space
                    subString = data.substring(1, i + 1);
                    break;
                }
            }
            range.setEnd(node, subString.length);
        } else {
            range.setEnd(node, offset + length);
        }
    }

    selectDateByClick(index) {
        const selection = window.getSelection();
        const offset = window.getSelection().anchorOffset;
        const data = window.getSelection().anchorNode['data'];
        const length = selection.toString().length;

        const range = selection.getRangeAt(0);
        const node = selection.anchorNode;

        range.setStart(node, 0);
        let subString = '';
        for (let i = offset + length; i < data.length; i++) {
            if (data[i] === '-' || data[i] === ' ' || data[i] === ':') {
                // Take it from index one because on index zero is now space
                subString = data.substring(1, i);

                break;
            }
        }
        range.setEnd(node, subString.length + 1);
    }

    /**
     * Computes background color of timestamp field based on differences of timestamps
     * @param actual String time of actual item in list
     * @param prev String time of previous item in list or null if there is no previous item
     * @param next String time of next item in list or null if there is no next item
     * @returns {any} Background color of timestamp field
     */
    getTableTimestampColor(actual, prev, next) {
        if (this.timestampColor.colored_nodes.has(actual)) {
            return this.timestampColor.colored_nodes.get(actual);
        } else {
            if (prev != null && this.timestampColor.colored_nodes.has(prev)) {
                if (actual !== prev) {
                    let color = this.timestampColor.colors[0];
                    for (let i = 0; i < this.timestampColor.colors.length; i++) {
                        if (this.timestampColor.colors[i] === this.timestampColor.colored_nodes.get(prev)) {
                            color = this.timestampColor.colors[(i + 1) % this.timestampColor.colors.length];
                        }
                    }
                    this.timestampColor.colored_nodes.set(actual, color);
                    return this.timestampColor.colored_nodes.get(actual);
                } else {
                    this.timestampColor.colored_nodes.set(actual, this.timestampColor.colored_nodes.get(prev));
                    return this.timestampColor.colored_nodes.get(actual);
                }
            } else if (next != null && this.timestampColor.colored_nodes.has(next)) {
                if (actual !== next) {
                    let color = this.timestampColor.colors[0];
                    for (let i = 0; i < this.timestampColor.colors.length; i++) {
                        if (this.timestampColor.colors[i] === this.timestampColor.colored_nodes.get(next)) {
                            color = this.timestampColor.colors[(i + 1) % this.timestampColor.colors.length];
                        }
                    }
                    this.timestampColor.colored_nodes.set(actual, color);
                    return this.timestampColor.colored_nodes.get(actual);
                } else {
                    this.timestampColor.colored_nodes.set(actual, this.timestampColor.colored_nodes.get(next));
                    return this.timestampColor.colored_nodes.get(actual);
                }
            } else {
                this.timestampColor.colored_nodes = new Map<string, string>();
                this.timestampColor.colored_nodes.set(actual, this.timestampColor.colors[0]);
                return this.timestampColor.colored_nodes.get(actual);
            }
        }
    }

    /**
     * Scrolls virtual scroll to given index
     * @param {number} index Index of item to scroll to
     */
    scrollToIndex(index: number) {
        console.log('requested scroll index:', index);
        const actualIndex = index < 0 ? 0 : index;
        const scrollPage = Math.floor(actualIndex / this.page_size) + 1;
        console.log('scrolling to index: ', actualIndex, ' on page: ', scrollPage);
        const scrollIndex = actualIndex % this.page_size;
        this.setPage(scrollPage);
        this.virtualScroller.scrollToIndex(scrollIndex - 1);
    }

    /**
     * Set page by page parameter
     * @param {number} page Number of requested page
     */
    setPage(page: number) {
        this.page_number = page;
        this.virtualArray.length =
            this.page_number * this.page_size > this.total ?
                this.total - ((this.page_number - 1) * this.page_size) :
                this.page_size;
    }

    /**
     * Triggered by page change
     * @param {number} page Number of page
     */
    changePage(page: number) {
        const scrollIndex = (page - 1) * this.page_size;
        this.scrollToIndex(scrollIndex);
        this.dataLoader(0, this.preloadedBufferSize, null, null, true, false);
    }

    /**
     * Method to drag timestamp
     * @param $event
     * @param {string} timestamp
     */
    dragTimestamp($event, timestamp: string) {
        $event.dataTransfer.setData('timestamp', JSON.stringify(timestamp));
        $event.dataTransfer.dropEffect = 'copy';
        $event.effectAllowed = 'copyMove';
    }
}
