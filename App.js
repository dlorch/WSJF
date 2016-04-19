/* global Ext */
Ext.define("CustomApp",{
	extend:"Rally.app.App",
	componentCls:"app",
	launch:function(){
		this.releaseCombobox=this.add({
			xtype:"rallyreleasecombobox",
			listeners:{
				ready:this._onReleaseComboboxLoad,
				change:this._onReleaseComboboxChanged,
				scope:this
			}
		});
	},
	_onReleaseComboboxLoad:function(){
		var query=this.releaseCombobox.getQueryFromSelected();
		this._loadFeatures(query);
	},
	_onReleaseComboboxChanged:function(){
		if(this._myGrid) { // TODO ignore if event is called before grid created
			var store=this._myGrid.getStore();
			store.clearFilter(!0),
			store.filter(this.releaseCombobox.getQueryFromSelected());
		}	
	},
	_loadFeatures:function(query){
		Ext.create("Rally.data.wsapi.Store",{
			model:"PortfolioItem/Feature",
			autoLoad:true,
			filters: query,
			remoteSort: true,
            sorters:[{ property:'Rank', direction: 'Asc'}],
			listeners:{
				load:function(store,records,success){
					this._calculateScore(records),
					this._updateGrid(store);
				},
				update:function(store,record,operation,modifiedFieldNames){
					this._calculateScore([record]);
				},
				scope:this
			},
			fetch:["Name","Rank","FormattedID","SizeofJob","CostofDelay","OpportunityRiskReduction","BusinessUserValue","TVWSJFScore","BusinessImpact","EpicOwner","MustLaunchTarget"]
		});
	},
	_calculateScore: function(records) {        
		Ext.Array.each(records, function(feature) {
			// get the data used to calc score
			// if poor performance is an issue, you can try taking off the parseInt casts
			var jobSize = feature.get("SizeofJob"); // parse int ensures we are dealing with ints, base 10
			var timeValue = feature.get("CostofDelay");
			var OERR = feature.get("OpportunityRiskReduction");
			var userValue = feature.get("BusinessUserValue");

			if (jobSize >= 0) { // jobSize is the denominator so make sure it's not 0
				if (jobSize < 1) {
					(jobSize = 1);
				}
				var score =  parseInt(parseFloat(((userValue + timeValue + OERR) / jobSize)).toFixed(2)*100, 10); // shortcut for casting to int
				var impact = parseFloat(userValue + timeValue + OERR)*100;
				
				if (parseInt(feature.get("TVWSJFScore") + "", 10) !== score) {
					feature.set('TVWSJFScore', score);
				}
				if (parseInt(feature.get("BusinessImpact") + "", 10) !== impact) {
					feature.set('BusinessImpact', impact);
				}
			}
		});
	},
	_createGrid:function(myStore){
		var mySort=function(state){
			var ds=this.up("grid").getStore(),
			field=this.getSortParam();
			ds.sort({
				property:field,direction:state,sorterFn:function(v1,v2){return v1=v1.get(field),v2=v2.get(field),v1>v2?1:v1==v2?0:v2>v1?-1:void 0;}
			});
		};
		this._myGrid=Ext.create("Rally.ui.grid.Grid",{
			xtype:"rallygrid",
			title:"Feature Scoring Grid",
			height:"98%",
			store:myStore,
			enableEditing:true,
			// TODO -- selType:"cellmodel",
			showRowActionsColumn:false,
			columnCfgs:[
				{xtype: "rownumberer", align: "left", header: "Row No.", flex:1},
				{text:"Portfolio ID", dataIndex:"FormattedID", flex:1, xtype:"templatecolumn", tpl:Ext.create("Rally.ui.renderer.template.FormattedIDTemplate")},
				{text:"Name", dataIndex:"Name"},
				"EpicOwner",
			    "MustLaunchTarget",
				"BusinessUserValue",
				{text:"Time Criticality", dataIndex:"CostofDelay"},
				"OpportunityRiskReduction",
				{text:"Cost of Delay", dataIndex:"BusinessImpact", editor: false},
				{text:"Job Size", dataIndex:"SizeofJob"},
				{text:"WSJF Score", dataIndex:"TVWSJFScore", editor: false, doSort:mySort}
			]
		}),
		this.add(this._myGrid);
		// TODO understand what this fragment does
		var celledit=this._myGrid.plugins[0],
			oldPub=celledit.publish,
			newPub=function(event,varargs){"objectupdate"!==event&&oldPub.apply(this,arguments);};
		celledit.publish=Ext.bind(newPub,celledit);
	},
	_updateGrid:function(myStore){
		void 0===this._myGrid?this._createGrid(myStore):this._myGrid.reconfigure(myStore);
	}
});