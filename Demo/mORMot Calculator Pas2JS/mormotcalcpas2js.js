var pas = { $libimports: {}};

var rtl = {

  version: 30101,

  quiet: false,
  debug_load_units: false,
  debug_rtti: false,

  $res : {},

  debug: function(){
    if (rtl.quiet || !console || !console.log) return;
    console.log(arguments);
  },

  error: function(s){
    rtl.debug('Error: ',s);
    throw s;
  },

  warn: function(s){
    rtl.debug('Warn: ',s);
  },

  checkVersion: function(v){
    if (rtl.version != v) throw "expected rtl version "+v+", but found "+rtl.version;
  },

  hiInt: Math.pow(2,53),

  hasString: function(s){
    return rtl.isString(s) && (s.length>0);
  },

  isArray: function(a) {
    return Array.isArray(a);
  },

  isFunction: function(f){
    return typeof(f)==="function";
  },

  isModule: function(m){
    return rtl.isObject(m) && rtl.hasString(m.$name) && (pas[m.$name]===m);
  },

  isImplementation: function(m){
    return rtl.isObject(m) && rtl.isModule(m.$module) && (m.$module.$impl===m);
  },

  isNumber: function(n){
    return typeof(n)==="number";
  },

  isObject: function(o){
    var s=typeof(o);
    return (typeof(o)==="object") && (o!=null);
  },

  isString: function(s){
    return typeof(s)==="string";
  },

  getNumber: function(n){
    return typeof(n)==="number"?n:NaN;
  },

  getChar: function(c){
    return ((typeof(c)==="string") && (c.length===1)) ? c : "";
  },

  getObject: function(o){
    return ((typeof(o)==="object") || (typeof(o)==='function')) ? o : null;
  },

  isTRecord: function(type){
    return (rtl.isObject(type) && type.hasOwnProperty('$new') && (typeof(type.$new)==='function'));
  },

  isPasClass: function(type){
    return (rtl.isObject(type) && type.hasOwnProperty('$classname') && rtl.isObject(type.$module));
  },

  isPasClassInstance: function(type){
    return (rtl.isObject(type) && rtl.isPasClass(type.$class));
  },

  hexStr: function(n,digits){
    return ("000000000000000"+n.toString(16).toUpperCase()).slice(-digits);
  },

  m_loading: 0,
  m_loading_intf: 1,
  m_intf_loaded: 2,
  m_loading_impl: 3, // loading all used unit
  m_initializing: 4, // running initialization
  m_initialized: 5,

  module: function(module_name, intfuseslist, intfcode, impluseslist){
    if (rtl.debug_load_units) rtl.debug('rtl.module name="'+module_name+'" intfuses='+intfuseslist+' impluses='+impluseslist);
    if (!rtl.hasString(module_name)) rtl.error('invalid module name "'+module_name+'"');
    if (!rtl.isArray(intfuseslist)) rtl.error('invalid interface useslist of "'+module_name+'"');
    if (!rtl.isFunction(intfcode)) rtl.error('invalid interface code of "'+module_name+'"');
    if (!(impluseslist==undefined) && !rtl.isArray(impluseslist)) rtl.error('invalid implementation useslist of "'+module_name+'"');

    if (pas[module_name])
      rtl.error('module "'+module_name+'" is already registered');

    var r = Object.create(rtl.tSectionRTTI);
    var module = r.$module = pas[module_name] = {
      $name: module_name,
      $intfuseslist: intfuseslist,
      $impluseslist: impluseslist,
      $state: rtl.m_loading,
      $intfcode: intfcode,
      $implcode: null,
      $impl: null,
      $rtti: r
    };
    if (impluseslist) module.$impl = {
          $module: module,
          $rtti: r
        };
  },

  exitcode: 0,

  run: function(module_name){
    try {
      if (!rtl.hasString(module_name)) module_name='program';
      if (rtl.debug_load_units) rtl.debug('rtl.run module="'+module_name+'"');
      rtl.initRTTI();
      var module = pas[module_name];
      if (!module) rtl.error('rtl.run module "'+module_name+'" missing');
      rtl.loadintf(module);
      rtl.loadimpl(module);
      if ((module_name=='program') || (module_name=='library')){
        if (rtl.debug_load_units) rtl.debug('running $main');
        var r = pas[module_name].$main();
        if (rtl.isNumber(r)) rtl.exitcode = r;
      }
    } catch(re) {
      if (!rtl.showUncaughtExceptions) {
        throw re
      } else {  
        if (!rtl.handleUncaughtException(re)) {
          rtl.showException(re);
          rtl.exitcode = 216;
        }  
      }
    } 
    return rtl.exitcode;
  },
  
  showException : function (re) {
    var errMsg = rtl.hasString(re.$classname) ? re.$classname : '';
    errMsg +=  ((errMsg) ? ': ' : '') + (re.hasOwnProperty('fMessage') ? re.fMessage : re);
    alert('Uncaught Exception : '+errMsg);
  },

  handleUncaughtException: function (e) {
    if (rtl.onUncaughtException) {
      try {
        rtl.onUncaughtException(e);
        return true;
      } catch (ee) {
        return false; 
      }
    } else {
      return false;
    }
  },

  loadintf: function(module){
    if (module.$state>rtl.m_loading_intf) return; // already finished
    if (rtl.debug_load_units) rtl.debug('loadintf: "'+module.$name+'"');
    if (module.$state===rtl.m_loading_intf)
      rtl.error('unit cycle detected "'+module.$name+'"');
    module.$state=rtl.m_loading_intf;
    // load interfaces of interface useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadintf);
    // run interface
    if (rtl.debug_load_units) rtl.debug('loadintf: run intf of "'+module.$name+'"');
    module.$intfcode(module.$intfuseslist);
    // success
    module.$state=rtl.m_intf_loaded;
    // Note: units only used in implementations are not yet loaded (not even their interfaces)
  },

  loaduseslist: function(module,useslist,f){
    if (useslist==undefined) return;
    var len = useslist.length;
    for (var i = 0; i<len; i++) {
      var unitname=useslist[i];
      if (rtl.debug_load_units) rtl.debug('loaduseslist of "'+module.$name+'" uses="'+unitname+'"');
      if (pas[unitname]==undefined)
        rtl.error('module "'+module.$name+'" misses "'+unitname+'"');
      f(pas[unitname]);
    }
  },

  loadimpl: function(module){
    if (module.$state>=rtl.m_loading_impl) return; // already processing
    if (module.$state<rtl.m_intf_loaded) rtl.error('loadimpl: interface not loaded of "'+module.$name+'"');
    if (rtl.debug_load_units) rtl.debug('loadimpl: load uses of "'+module.$name+'"');
    module.$state=rtl.m_loading_impl;
    // load interfaces of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadintf);
    // load implementation of interfaces useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadimpl);
    // load implementation of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadimpl);
    // Note: At this point all interfaces used by this unit are loaded. If
    //   there are implementation uses cycles some used units might not yet be
    //   initialized. This is by design.
    // run implementation
    if (rtl.debug_load_units) rtl.debug('loadimpl: run impl of "'+module.$name+'"');
    if (rtl.isFunction(module.$implcode)) module.$implcode(module.$impluseslist);
    // run initialization
    if (rtl.debug_load_units) rtl.debug('loadimpl: run init of "'+module.$name+'"');
    module.$state=rtl.m_initializing;
    if (rtl.isFunction(module.$init)) module.$init();
    // unit initialized
    module.$state=rtl.m_initialized;
  },

  createCallback: function(scope, fn){
    var cb;
    if (typeof(fn)==='string'){
      if (!scope.hasOwnProperty('$events')) scope.$events = {};
      cb = scope.$events[fn];
      if (cb) return cb;
      scope.$events[fn] = cb = function(){
        return scope[fn].apply(scope,arguments);
      };
    } else {
      cb = function(){
        return fn.apply(scope,arguments);
      };
    };
    cb.scope = scope;
    cb.fn = fn;
    return cb;
  },

  createSafeCallback: function(scope, fn){
    var cb;
    if (typeof(fn)==='string'){
      if (!scope[fn]) return null;
      if (!scope.hasOwnProperty('$events')) scope.$events = {};
      cb = scope.$events[fn];
      if (cb) return cb;
      scope.$events[fn] = cb = function(){
        try{
          return scope[fn].apply(scope,arguments);
        } catch (err) {
          if (!rtl.handleUncaughtException(err)) throw err;
        }
      };
    } else if(!fn) {
      return null;
    } else {
      cb = function(){
        try{
          return fn.apply(scope,arguments);
        } catch (err) {
          if (!rtl.handleUncaughtException(err)) throw err;
        }
      };
    };
    cb.scope = scope;
    cb.fn = fn;
    return cb;
  },

  eqCallback: function(a,b){
    // can be a function or a function wrapper
    if (a===b){
      return true;
    } else {
      return (a!=null) && (b!=null) && (a.fn) && (a.scope===b.scope) && (a.fn===b.fn);
    }
  },

  initStruct: function(c,parent,name){
    if ((parent.$module) && (parent.$module.$impl===parent)) parent=parent.$module;
    c.$parent = parent;
    if (rtl.isModule(parent)){
      c.$module = parent;
      c.$name = name;
    } else {
      c.$module = parent.$module;
      c.$name = parent.$name+'.'+name;
    };
    return parent;
  },

  initClass: function(c,parent,name,initfn,rttiname){
    parent[name] = c;
    c.$class = c; // Note: o.$class === Object.getPrototypeOf(o)
    c.$classname = rttiname?rttiname:name;
    parent = rtl.initStruct(c,parent,name);
    c.$fullname = parent.$name+'.'+name;
    // rtti
    if (rtl.debug_rtti) rtl.debug('initClass '+c.$fullname);
    var t = c.$module.$rtti.$Class(c.$classname,{ "class": c });
    c.$rtti = t;
    if (rtl.isObject(c.$ancestor)) t.ancestor = c.$ancestor.$rtti;
    if (!t.ancestor) t.ancestor = null;
    // init members
    initfn.call(c);
  },

  createClass: function(parent,name,ancestor,initfn,rttiname){
    // create a normal class,
    // ancestor must be null or a normal class,
    // the root ancestor can be an external class
    var c = null;
    if (ancestor != null){
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
      // Note:
      // if root is an "object" then c.$ancestor === Object.getPrototypeOf(c)
      // if root is a "function" then c.$ancestor === c.__proto__, Object.getPrototypeOf(c) returns the root
    } else {
      c = { $ancestor: null };
      c.$create = function(fn,args){
        if (args == undefined) args = [];
        var o = Object.create(this);
        o.$init();
        try{
          if (typeof(fn)==="string"){
            o[fn].apply(o,args);
          } else {
            fn.apply(o,args);
          };
          o.AfterConstruction();
        } catch($e){
          // do not call BeforeDestruction
          if (o.Destroy) o.Destroy();
          o.$final();
          throw $e;
        }
        return o;
      };
      c.$destroy = function(fnname){
        this.BeforeDestruction();
        if (this[fnname]) this[fnname]();
        this.$final();
      };
    };
    rtl.initClass(c,parent,name,initfn,rttiname);
  },

  createClassExt: function(parent,name,ancestor,newinstancefnname,initfn,rttiname){
    // Create a class using an external ancestor.
    // If newinstancefnname is given, use that function to create the new object.
    // If exist call BeforeDestruction and AfterConstruction.
    var isFunc = rtl.isFunction(ancestor);
    var c = null;
    if (isFunc){
      // create pascal class descendent from JS function
      c = Object.create(ancestor.prototype);
      c.$ancestorfunc = ancestor;
      c.$ancestor = null; // no pascal ancestor
    } else if (ancestor.$func){
      // create pascal class descendent from a pascal class descendent of a JS function
      isFunc = true;
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
    } else {
      c = Object.create(ancestor);
      c.$ancestor = null; // no pascal ancestor
    }
    c.$create = function(fn,args){
      if (args == undefined) args = [];
      var o = null;
      if (newinstancefnname.length>0){
        o = this[newinstancefnname](fn,args);
      } else if(isFunc) {
        o = new this.$func(args);
      } else {
        o = Object.create(c);
      }
      if (o.$init) o.$init();
      try{
        if (typeof(fn)==="string"){
          this[fn].apply(o,args);
        } else {
          fn.apply(o,args);
        };
        if (o.AfterConstruction) o.AfterConstruction();
      } catch($e){
        // do not call BeforeDestruction
        if (o.Destroy) o.Destroy();
        if (o.$final) o.$final();
        throw $e;
      }
      return o;
    };
    c.$destroy = function(fnname){
      if (this.BeforeDestruction) this.BeforeDestruction();
      if (this[fnname]) this[fnname]();
      if (this.$final) this.$final();
    };
    rtl.initClass(c,parent,name,initfn,rttiname);
    if (isFunc){
      function f(){}
      f.prototype = c;
      c.$func = f;
    }
  },

  createHelper: function(parent,name,ancestor,initfn,rttiname){
    // create a helper,
    // ancestor must be null or a helper,
    var c = null;
    if (ancestor != null){
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
      // c.$ancestor === Object.getPrototypeOf(c)
    } else {
      c = { $ancestor: null };
    };
    parent[name] = c;
    c.$class = c; // Note: o.$class === Object.getPrototypeOf(o)
    c.$classname = rttiname?rttiname:name;
    parent = rtl.initStruct(c,parent,name);
    c.$fullname = parent.$name+'.'+name;
    // rtti
    var t = c.$module.$rtti.$Helper(c.$classname,{ "helper": c });
    c.$rtti = t;
    if (rtl.isObject(ancestor)) t.ancestor = ancestor.$rtti;
    if (!t.ancestor) t.ancestor = null;
    // init members
    initfn.call(c);
  },

  tObjectDestroy: "Destroy",

  free: function(obj,name){
    if (obj[name]==null) return null;
    obj[name].$destroy(rtl.tObjectDestroy);
    obj[name]=null;
  },

  freeLoc: function(obj){
    if (obj==null) return null;
    obj.$destroy(rtl.tObjectDestroy);
    return null;
  },

  hideProp: function(o,p,v){
    Object.defineProperty(o,p, {
      enumerable: false,
      configurable: true,
      writable: true
    });
    if(arguments.length>2){ o[p]=v; }
  },

  recNewT: function(parent,name,initfn,full){
    // create new record type
    var t = {};
    if (parent) parent[name] = t;
    var h = rtl.hideProp;
    if (full){
      rtl.initStruct(t,parent,name);
      t.$record = t;
      h(t,'$record');
      h(t,'$name');
      h(t,'$parent');
      h(t,'$module');
      h(t,'$initSpec');
    }
    initfn.call(t);
    if (!t.$new){
      t.$new = function(){ return Object.create(t); };
    }
    t.$clone = function(r){ return t.$new().$assign(r); };
    h(t,'$new');
    h(t,'$clone');
    h(t,'$eq');
    h(t,'$assign');
    return t;
  },

  is: function(instance,type){
    return type.isPrototypeOf(instance) || (instance===type);
  },

  isExt: function(instance,type,mode){
    // mode===1 means instance must be a Pascal class instance
    // mode===2 means instance must be a Pascal class
    // Notes:
    // isPrototypeOf and instanceof return false on equal
    // isPrototypeOf does not work for Date.isPrototypeOf(new Date())
    //   so if isPrototypeOf is false test with instanceof
    // instanceof needs a function on right side
    if (instance == null) return false; // Note: ==null checks for undefined too
    if ((typeof(type) !== 'object') && (typeof(type) !== 'function')) return false;
    if (instance === type){
      if (mode===1) return false;
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if (type.isPrototypeOf && type.isPrototypeOf(instance)){
      if (mode===1) return rtl.isPasClassInstance(instance);
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if ((typeof type == 'function') && (instance instanceof type)) return true;
    return false;
  },

  Exception: null,
  EInvalidCast: null,
  EAbstractError: null,
  ERangeError: null,
  EIntOverflow: null,
  EPropWriteOnly: null,

  raiseE: function(typename){
    var t = rtl[typename];
    if (t==null){
      var mod = pas.SysUtils;
      if (!mod) mod = pas.sysutils;
      if (mod){
        t = mod[typename];
        if (!t) t = mod[typename.toLowerCase()];
        if (!t) t = mod['Exception'];
        if (!t) t = mod['exception'];
      }
    }
    if (t){
      if (t.Create){
        throw t.$create("Create");
      } else if (t.create){
        throw t.$create("create");
      }
    }
    if (typename === "EInvalidCast") throw "invalid type cast";
    if (typename === "EAbstractError") throw "Abstract method called";
    if (typename === "ERangeError") throw "range error";
    throw typename;
  },

  as: function(instance,type){
    if((instance === null) || rtl.is(instance,type)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  asExt: function(instance,type,mode){
    if((instance === null) || rtl.isExt(instance,type,mode)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  createInterface: function(module, name, guid, fnnames, ancestor, initfn, rttiname){
    //console.log('createInterface name="'+name+'" guid="'+guid+'" names='+fnnames);
    var i = ancestor?Object.create(ancestor):{};
    module[name] = i;
    i.$module = module;
    i.$name = rttiname?rttiname:name;
    i.$fullname = module.$name+'.'+i.$name;
    i.$guid = guid;
    i.$guidr = null;
    i.$names = fnnames?fnnames:[];
    if (rtl.isFunction(initfn)){
      // rtti
      if (rtl.debug_rtti) rtl.debug('createInterface '+i.$fullname);
      var t = i.$module.$rtti.$Interface(i.$name,{ "interface": i, module: module });
      i.$rtti = t;
      if (ancestor) t.ancestor = ancestor.$rtti;
      if (!t.ancestor) t.ancestor = null;
      initfn.call(i);
    }
    return i;
  },

  strToGUIDR: function(s,g){
    var p = 0;
    function n(l){
      var h = s.substr(p,l);
      p+=l;
      return parseInt(h,16);
    }
    p+=1; // skip {
    g.D1 = n(8);
    p+=1; // skip -
    g.D2 = n(4);
    p+=1; // skip -
    g.D3 = n(4);
    p+=1; // skip -
    if (!g.D4) g.D4=[];
    g.D4[0] = n(2);
    g.D4[1] = n(2);
    p+=1; // skip -
    for(var i=2; i<8; i++) g.D4[i] = n(2);
    return g;
  },

  guidrToStr: function(g){
    if (g.$intf) return g.$intf.$guid;
    var h = rtl.hexStr;
    var s='{'+h(g.D1,8)+'-'+h(g.D2,4)+'-'+h(g.D3,4)+'-'+h(g.D4[0],2)+h(g.D4[1],2)+'-';
    for (var i=2; i<8; i++) s+=h(g.D4[i],2);
    s+='}';
    return s;
  },

  createTGUID: function(guid){
    var TGuid = (pas.System)?pas.System.TGuid:pas.system.tguid;
    var g = rtl.strToGUIDR(guid,TGuid.$new());
    return g;
  },

  getIntfGUIDR: function(intfTypeOrVar){
    if (!intfTypeOrVar) return null;
    if (!intfTypeOrVar.$guidr){
      var g = rtl.createTGUID(intfTypeOrVar.$guid);
      if (!intfTypeOrVar.hasOwnProperty('$guid')) intfTypeOrVar = Object.getPrototypeOf(intfTypeOrVar);
      g.$intf = intfTypeOrVar;
      intfTypeOrVar.$guidr = g;
    }
    return intfTypeOrVar.$guidr;
  },

  addIntf: function (aclass, intf, map){
    function jmp(fn){
      if (typeof(fn)==="function"){
        return function(){ return fn.apply(this.$o,arguments); };
      } else {
        return function(){ rtl.raiseE('EAbstractError'); };
      }
    }
    if(!map) map = {};
    var t = intf;
    var item = Object.create(t);
    if (!aclass.hasOwnProperty('$intfmaps')) aclass.$intfmaps = {};
    aclass.$intfmaps[intf.$guid] = item;
    do{
      var names = t.$names;
      if (!names) break;
      for (var i=0; i<names.length; i++){
        var intfname = names[i];
        var fnname = map[intfname];
        if (!fnname) fnname = intfname;
        //console.log('addIntf: intftype='+t.$name+' index='+i+' intfname="'+intfname+'" fnname="'+fnname+'" old='+typeof(item[intfname]));
        item[intfname] = jmp(aclass[fnname]);
      }
      t = Object.getPrototypeOf(t);
    }while(t!=null);
  },

  getIntfG: function (obj, guid, query){
    if (!obj) return null;
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query);
    // search
    var maps = obj.$intfmaps;
    if (!maps) return null;
    var item = maps[guid];
    if (!item) return null;
    // check delegation
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query+' item='+typeof(item));
    if (typeof item === 'function') return item.call(obj); // delegate. Note: COM contains _AddRef
    // check cache
    var intf = null;
    if (obj.$interfaces){
      intf = obj.$interfaces[guid];
      //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' cache='+typeof(intf));
    }
    if (!intf){ // intf can be undefined!
      intf = Object.create(item);
      intf.$o = obj;
      if (!obj.$interfaces) obj.$interfaces = {};
      obj.$interfaces[guid] = intf;
    }
    if (typeof(query)==='object'){
      // called by queryIntfT
      var o = null;
      if (intf.QueryInterface(rtl.getIntfGUIDR(query),
          {get:function(){ return o; }, set:function(v){ o=v; }}) === 0){
        return o;
      } else {
        return null;
      }
    } else if(query===2){
      // called by TObject.GetInterfaceByStr
      if (intf.$kind === 'com') intf._AddRef();
    }
    return intf;
  },

  getIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid);
  },

  queryIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid,intftype);
  },

  queryIntfIsT: function(obj,intftype){
    var i = rtl.getIntfG(obj,intftype.$guid);
    if (!i) return false;
    if (i.$kind === 'com') i._Release();
    return true;
  },

  asIntfT: function (obj,intftype){
    var i = rtl.getIntfG(obj,intftype.$guid);
    if (i!==null) return i;
    rtl.raiseEInvalidCast();
  },

  intfIsIntfT: function(intf,intftype){
    return (intf!==null) && rtl.queryIntfIsT(intf.$o,intftype);
  },

  intfAsIntfT: function (intf,intftype){
    if (!intf) return null;
    var i = rtl.getIntfG(intf.$o,intftype.$guid);
    if (i) return i;
    rtl.raiseEInvalidCast();
  },

  intfIsClass: function(intf,classtype){
    return (intf!=null) && (rtl.is(intf.$o,classtype));
  },

  intfAsClass: function(intf,classtype){
    if (intf==null) return null;
    return rtl.as(intf.$o,classtype);
  },

  intfToClass: function(intf,classtype){
    if ((intf!==null) && rtl.is(intf.$o,classtype)) return intf.$o;
    return null;
  },

  // interface reference counting
  intfRefs: { // base object for temporary interface variables
    ref: function(id,intf){
      // called for temporary interface references needing delayed release
      var old = this[id];
      //console.log('rtl.intfRefs.ref: id='+id+' old="'+(old?old.$name:'null')+'" intf="'+(intf?intf.$name:'null')+' $o='+(intf?intf.$o:'null'));
      if (old){
        // called again, e.g. in a loop
        delete this[id];
        old._Release(); // may fail
      }
      if(intf) {
        this[id]=intf;
      }
      return intf;
    },
    free: function(){
      //console.log('rtl.intfRefs.free...');
      for (var id in this){
        if (this.hasOwnProperty(id)){
          var intf = this[id];
          if (intf){
            //console.log('rtl.intfRefs.free: id='+id+' '+intf.$name+' $o='+intf.$o.$classname);
            intf._Release();
          }
        }
      }
    }
  },

  createIntfRefs: function(){
    //console.log('rtl.createIntfRefs');
    return Object.create(rtl.intfRefs);
  },

  setIntfP: function(path,name,value,skipAddRef){
    var old = path[name];
    //console.log('rtl.setIntfP path='+path+' name='+name+' old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old === value) return;
    if (old !== null){
      path[name]=null;
      old._Release();
    }
    if (value !== null){
      if (!skipAddRef) value._AddRef();
      path[name]=value;
    }
  },

  setIntfL: function(old,value,skipAddRef){
    //console.log('rtl.setIntfL old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old !== value){
      if (value!==null){
        if (!skipAddRef) value._AddRef();
      }
      if (old!==null){
        old._Release();  // Release after AddRef, to avoid double Release if Release creates an exception
      }
    } else if (skipAddRef){
      if (old!==null){
        old._Release();  // value has an AddRef
      }
    }
    return value;
  },

  _AddRef: function(intf){
    //if (intf) console.log('rtl._AddRef intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._AddRef();
    return intf;
  },

  _Release: function(intf){
    //if (intf) console.log('rtl._Release intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._Release();
    return intf;
  },

  _ReleaseArray: function(a,dim){
    if (!a) return null;
    for (var i=0; i<a.length; i++){
      if (dim<=1){
        if (a[i]) a[i]._Release();
      } else {
        rtl._ReleaseArray(a[i],dim-1);
      }
    }
    return null;
  },

  trunc: function(a){
    return a<0 ? Math.ceil(a) : Math.floor(a);
  },

  checkMethodCall: function(obj,type){
    if (rtl.isObject(obj) && rtl.is(obj,type)) return;
    rtl.raiseE("EInvalidCast");
  },

  oc: function(i){
    // overflow check integer
    if ((Math.floor(i)===i) && (i>=-0x1fffffffffffff) && (i<=0x1fffffffffffff)) return i;
    rtl.raiseE('EIntOverflow');
  },

  rc: function(i,minval,maxval){
    // range check integer
    if ((Math.floor(i)===i) && (i>=minval) && (i<=maxval)) return i;
    rtl.raiseE('ERangeError');
  },

  rcc: function(c,minval,maxval){
    // range check char
    if ((typeof(c)==='string') && (c.length===1)){
      var i = c.charCodeAt(0);
      if ((i>=minval) && (i<=maxval)) return c;
    }
    rtl.raiseE('ERangeError');
  },

  rcSetCharAt: function(s,index,c){
    // range check setCharAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return rtl.setCharAt(s,index,c);
  },

  rcCharAt: function(s,index){
    // range check charAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return s.charAt(index);
  },

  rcArrR: function(arr,index){
    // range check read array
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      if (arguments.length>2){
        // arr,index1,index2,...
        arr=arr[index];
        for (var i=2; i<arguments.length; i++) arr=rtl.rcArrR(arr,arguments[i]);
        return arr;
      }
      return arr[index];
    }
    rtl.raiseE('ERangeError');
  },

  rcArrW: function(arr,index,value){
    // range check write array
    // arr,index1,index2,...,value
    for (var i=3; i<arguments.length; i++){
      arr=rtl.rcArrR(arr,index);
      index=arguments[i-1];
      value=arguments[i];
    }
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      return arr[index]=value;
    }
    rtl.raiseE('ERangeError');
  },

  length: function(arr){
    return (arr == null) ? 0 : arr.length;
  },

  arrayRef: function(a){
    if (a!=null) rtl.hideProp(a,'$pas2jsrefcnt',1);
    return a;
  },

  arraySetLength: function(arr,defaultvalue,newlength){
    var stack = [];
    var s = 9999;
    for (var i=2; i<arguments.length; i++){
      var j = arguments[i];
      if (j==='s'){ s = i-2; }
      else {
        stack.push({ dim:j+0, a:null, i:0, src:null });
      }
    }
    var dimmax = stack.length-1;
    var depth = 0;
    var lastlen = 0;
    var item = null;
    var a = null;
    var src = arr;
    var srclen = 0, oldlen = 0;
    do{
      if (depth>0){
        item=stack[depth-1];
        src = (item.src && item.src.length>item.i)?item.src[item.i]:null;
      }
      if (!src){
        a = [];
        srclen = 0;
        oldlen = 0;
      } else if (src.$pas2jsrefcnt>0 || depth>=s){
        a = [];
        srclen = src.length;
        oldlen = srclen;
      } else {
        a = src;
        srclen = 0;
        oldlen = a.length;
      }
      lastlen = stack[depth].dim;
      a.length = lastlen;
      if (depth>0){
        item.a[item.i]=a;
        item.i++;
        if ((lastlen===0) && (item.i<item.a.length)) continue;
      }
      if (lastlen>0){
        if (depth<dimmax){
          item = stack[depth];
          item.a = a;
          item.i = 0;
          item.src = src;
          depth++;
          continue;
        } else {
          if (srclen>lastlen) srclen=lastlen;
          if (rtl.isArray(defaultvalue)){
            // array of dyn array
            for (var i=0; i<srclen; i++) a[i]=src[i];
            for (var i=oldlen; i<lastlen; i++) a[i]=[];
          } else if (rtl.isObject(defaultvalue)) {
            if (rtl.isTRecord(defaultvalue)){
              // array of record
              for (var i=0; i<srclen; i++) a[i]=defaultvalue.$clone(src[i]);
              for (var i=oldlen; i<lastlen; i++) a[i]=defaultvalue.$new();
            } else {
              // array of set
              for (var i=0; i<srclen; i++) a[i]=rtl.refSet(src[i]);
              for (var i=oldlen; i<lastlen; i++) a[i]={};
            }
          } else {
            for (var i=0; i<srclen; i++) a[i]=src[i];
            for (var i=oldlen; i<lastlen; i++) a[i]=defaultvalue;
          }
        }
      }
      // backtrack
      while ((depth>0) && (stack[depth-1].i>=stack[depth-1].dim)){
        depth--;
      };
      if (depth===0){
        if (dimmax===0) return a;
        return stack[0].a;
      }
    }while (true);
  },

  arrayEq: function(a,b){
    if (a===null) return b===null;
    if (b===null) return false;
    if (a.length!==b.length) return false;
    for (var i=0; i<a.length; i++) if (a[i]!==b[i]) return false;
    return true;
  },

  arrayClone: function(type,src,srcpos,endpos,dst,dstpos){
    // type: 0 for references, "refset" for calling refSet(), a function for new type()
    // src must not be null
    // This function does not range check.
    if(type === 'refSet') {
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = rtl.refSet(src[srcpos]); // ref set
    } else if (type === 'slice'){
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = src[srcpos].slice(0); // clone static array of simple types
    } else if (typeof(type)==='function'){
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = type(src[srcpos]); // clone function
    } else if (rtl.isTRecord(type)){
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = type.$clone(src[srcpos]); // clone record
    }  else {
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = src[srcpos]; // reference
    };
  },

  arrayConcat: function(type){
    // type: see rtl.arrayClone
    var a = [];
    var l = 0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src !== null) l+=src.length;
    };
    a.length = l;
    l=0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src === null) continue;
      rtl.arrayClone(type,src,0,src.length,a,l);
      l+=src.length;
    };
    return a;
  },

  arrayConcatN: function(){
    var a = null;
    for (var i=0; i<arguments.length; i++){
      var src = arguments[i];
      if (src === null) continue;
      if (a===null){
        a=rtl.arrayRef(src); // Note: concat(a) does not clone
      } else if (a['$pas2jsrefcnt']){
        a=a.concat(src); // clone a and append src
      } else {
        for (var i=0; i<src.length; i++){
          a.push(src[i]);
        }
      }
    };
    return a;
  },

  arrayPush: function(type,a){
    if(a===null){
      a=[];
    } else if (a['$pas2jsrefcnt']){
      a=rtl.arrayCopy(type,a,0,a.length);
    }
    rtl.arrayClone(type,arguments,2,arguments.length,a,a.length);
    return a;
  },

  arrayPushN: function(a){
    if(a===null){
      a=[];
    } else if (a['$pas2jsrefcnt']){
      a=a.concat();
    }
    for (var i=1; i<arguments.length; i++){
      a.push(arguments[i]);
    }
    return a;
  },

  arrayCopy: function(type, srcarray, index, count){
    // type: see rtl.arrayClone
    // if count is missing, use srcarray.length
    if (srcarray === null) return [];
    if (index < 0) index = 0;
    if (count === undefined) count=srcarray.length;
    var end = index+count;
    if (end>srcarray.length) end = srcarray.length;
    if (index>=end) return [];
    if (type===0){
      return srcarray.slice(index,end);
    } else {
      var a = [];
      a.length = end-index;
      rtl.arrayClone(type,srcarray,index,end,a,0);
      return a;
    }
  },

  arrayInsert: function(item, arr, index){
    if (arr){
      arr.splice(index,0,item);
      return arr;
    } else {
      return [item];
    }
  },

  setCharAt: function(s,index,c){
    return s.substr(0,index)+c+s.substr(index+1);
  },

  getResStr: function(mod,name){
    var rs = mod.$resourcestrings[name];
    return rs.current?rs.current:rs.org;
  },

  createSet: function(){
    var s = {};
    for (var i=0; i<arguments.length; i++){
      if (arguments[i]!=null){
        s[arguments[i]]=true;
      } else {
        var first=arguments[i+=1];
        var last=arguments[i+=1];
        for(var j=first; j<=last; j++) s[j]=true;
      }
    }
    return s;
  },

  cloneSet: function(s){
    var r = {};
    for (var key in s) r[key]=true;
    return r;
  },

  refSet: function(s){
    rtl.hideProp(s,'$shared',true);
    return s;
  },

  includeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    s[enumvalue] = true;
    return s;
  },

  excludeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    delete s[enumvalue];
    return s;
  },

  diffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    return r;
  },

  unionSet: function(s,t){
    var r = {};
    for (var key in s) r[key]=true;
    for (var key in t) r[key]=true;
    return r;
  },

  intersectSet: function(s,t){
    var r = {};
    for (var key in s) if (t[key]) r[key]=true;
    return r;
  },

  symDiffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    for (var key in t) if (!s[key]) r[key]=true;
    return r;
  },

  eqSet: function(s,t){
    for (var key in s) if (!t[key]) return false;
    for (var key in t) if (!s[key]) return false;
    return true;
  },

  neSet: function(s,t){
    return !rtl.eqSet(s,t);
  },

  leSet: function(s,t){
    for (var key in s) if (!t[key]) return false;
    return true;
  },

  geSet: function(s,t){
    for (var key in t) if (!s[key]) return false;
    return true;
  },

  strSetLength: function(s,newlen){
    var oldlen = s.length;
    if (oldlen > newlen){
      return s.substring(0,newlen);
    } else if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return s+' '.repeat(newlen-oldlen);
    } else {
       while (oldlen<newlen){
         s+=' ';
         oldlen++;
       };
       return s;
    }
  },

  spaceLeft: function(s,width){
    var l=s.length;
    if (l>=width) return s;
    if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return ' '.repeat(width-l) + s;
    } else {
      while (l<width){
        s=' '+s;
        l++;
      };
      return s;
    };
  },

  floatToStr: function(d,w,p){
    // input 1-3 arguments: double, width, precision
    if (arguments.length>2){
      return rtl.spaceLeft(d.toFixed(p),w);
    } else {
	  // exponent width
	  var pad = "";
	  var ad = Math.abs(d);
	  if (((ad>1) && (ad<1.0e+10)) ||  ((ad>1.e-10) && (ad<1))) {
		pad='00';
	  } else if ((ad>1) && (ad<1.0e+100) || (ad<1.e-10)) {
		pad='0';
      }  	
	  if (arguments.length<2) {
	    w=24;		
      } else if (w<9) {
		w=9;
      }		  
      var p = w-8;
      var s=(d>0 ? " " : "" ) + d.toExponential(p);
      s=s.replace(/e(.)/,'E$1'+pad);
      return rtl.spaceLeft(s,w);
    }
  },

  valEnum: function(s, enumType, setCodeFn){
    s = s.toLowerCase();
    for (var key in enumType){
      if((typeof(key)==='string') && (key.toLowerCase()===s)){
        setCodeFn(0);
        return enumType[key];
      }
    }
    setCodeFn(1);
    return 0;
  },

  lw: function(l){
    // fix longword bitwise operation
    return l<0?l+0x100000000:l;
  },

  and: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) & (b / hi);
    var l = (a & low) & (b & low);
    return h*hi + l;
  },

  or: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) | (b / hi);
    var l = (a & low) | (b & low);
    return h*hi + l;
  },

  xor: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) ^ (b / hi);
    var l = (a & low) ^ (b & low);
    return h*hi + l;
  },

  shr: function(a,b){
    if (a<0) a += rtl.hiInt;
    if (a<0x80000000) return a >> b;
    if (b<=0) return a;
    if (b>54) return 0;
    return Math.floor(a / Math.pow(2,b));
  },

  shl: function(a,b){
    if (a<0) a += rtl.hiInt;
    if (b<=0) return a;
    if (b>54) return 0;
    var r = a * Math.pow(2,b);
    if (r <= rtl.hiInt) return r;
    return r % rtl.hiInt;
  },

  initRTTI: function(){
    if (rtl.debug_rtti) rtl.debug('initRTTI');

    // base types
    rtl.tTypeInfo = { name: "tTypeInfo", kind: 0, $module: null, attr: null };
    function newBaseTI(name,kind,ancestor){
      if (!ancestor) ancestor = rtl.tTypeInfo;
      if (rtl.debug_rtti) rtl.debug('initRTTI.newBaseTI "'+name+'" '+kind+' ("'+ancestor.name+'")');
      var t = Object.create(ancestor);
      t.name = name;
      t.kind = kind;
      rtl[name] = t;
      return t;
    };
    function newBaseInt(name,minvalue,maxvalue,ordtype){
      var t = newBaseTI(name,1 /* tkInteger */,rtl.tTypeInfoInteger);
      t.minvalue = minvalue;
      t.maxvalue = maxvalue;
      t.ordtype = ordtype;
      return t;
    };
    newBaseTI("tTypeInfoInteger",1 /* tkInteger */);
    newBaseInt("shortint",-0x80,0x7f,0);
    newBaseInt("byte",0,0xff,1);
    newBaseInt("smallint",-0x8000,0x7fff,2);
    newBaseInt("word",0,0xffff,3);
    newBaseInt("longint",-0x80000000,0x7fffffff,4);
    newBaseInt("longword",0,0xffffffff,5);
    newBaseInt("nativeint",-0x10000000000000,0xfffffffffffff,6);
    newBaseInt("nativeuint",0,0xfffffffffffff,7);
    newBaseTI("char",2 /* tkChar */);
    newBaseTI("string",3 /* tkString */);
    newBaseTI("tTypeInfoEnum",4 /* tkEnumeration */,rtl.tTypeInfoInteger);
    newBaseTI("tTypeInfoSet",5 /* tkSet */);
    newBaseTI("double",6 /* tkDouble */);
    newBaseTI("boolean",7 /* tkBool */);
    newBaseTI("tTypeInfoProcVar",8 /* tkProcVar */);
    newBaseTI("tTypeInfoMethodVar",9 /* tkMethod */,rtl.tTypeInfoProcVar);
    newBaseTI("tTypeInfoArray",10 /* tkArray */);
    newBaseTI("tTypeInfoDynArray",11 /* tkDynArray */);
    newBaseTI("tTypeInfoPointer",15 /* tkPointer */);
    var t = newBaseTI("pointer",15 /* tkPointer */,rtl.tTypeInfoPointer);
    t.reftype = null;
    newBaseTI("jsvalue",16 /* tkJSValue */);
    newBaseTI("tTypeInfoRefToProcVar",17 /* tkRefToProcVar */,rtl.tTypeInfoProcVar);

    // member kinds
    rtl.tTypeMember = { attr: null };
    function newMember(name,kind){
      var m = Object.create(rtl.tTypeMember);
      m.name = name;
      m.kind = kind;
      rtl[name] = m;
    };
    newMember("tTypeMemberField",1); // tmkField
    newMember("tTypeMemberMethod",2); // tmkMethod
    newMember("tTypeMemberProperty",3); // tmkProperty

    // base object for storing members: a simple object
    rtl.tTypeMembers = {};

    // tTypeInfoStruct - base object for tTypeInfoClass, tTypeInfoRecord, tTypeInfoInterface
    var tis = newBaseTI("tTypeInfoStruct",0);
    tis.$addMember = function(name,ancestor,options){
      if (rtl.debug_rtti){
        if (!rtl.hasString(name) || (name.charAt()==='$')) throw 'invalid member "'+name+'", this="'+this.name+'"';
        if (!rtl.is(ancestor,rtl.tTypeMember)) throw 'invalid ancestor "'+ancestor+':'+ancestor.name+'", "'+this.name+'.'+name+'"';
        if ((options!=undefined) && (typeof(options)!='object')) throw 'invalid options "'+options+'", "'+this.name+'.'+name+'"';
      };
      var t = Object.create(ancestor);
      t.name = name;
      this.members[name] = t;
      this.names.push(name);
      if (rtl.isObject(options)){
        for (var key in options) if (options.hasOwnProperty(key)) t[key] = options[key];
      };
      return t;
    };
    tis.addField = function(name,type,options){
      var t = this.$addMember(name,rtl.tTypeMemberField,options);
      if (rtl.debug_rtti){
        if (!rtl.is(type,rtl.tTypeInfo)) throw 'invalid type "'+type+'", "'+this.name+'.'+name+'"';
      };
      t.typeinfo = type;
      this.fields.push(name);
      return t;
    };
    tis.addFields = function(){
      var i=0;
      while(i<arguments.length){
        var name = arguments[i++];
        var type = arguments[i++];
        if ((i<arguments.length) && (typeof(arguments[i])==='object')){
          this.addField(name,type,arguments[i++]);
        } else {
          this.addField(name,type);
        };
      };
    };
    tis.addMethod = function(name,methodkind,params,result,flags,options){
      var t = this.$addMember(name,rtl.tTypeMemberMethod,options);
      t.methodkind = methodkind;
      t.procsig = rtl.newTIProcSig(params,result,flags);
      this.methods.push(name);
      return t;
    };
    tis.addProperty = function(name,flags,result,getter,setter,options){
      var t = this.$addMember(name,rtl.tTypeMemberProperty,options);
      t.flags = flags;
      t.typeinfo = result;
      t.getter = getter;
      t.setter = setter;
      // Note: in options: params, stored, defaultvalue
      t.params = rtl.isArray(t.params) ? rtl.newTIParams(t.params) : null;
      this.properties.push(name);
      if (!rtl.isString(t.stored)) t.stored = "";
      return t;
    };
    tis.getField = function(index){
      return this.members[this.fields[index]];
    };
    tis.getMethod = function(index){
      return this.members[this.methods[index]];
    };
    tis.getProperty = function(index){
      return this.members[this.properties[index]];
    };

    newBaseTI("tTypeInfoRecord",12 /* tkRecord */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClass",13 /* tkClass */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClassRef",14 /* tkClassRef */);
    newBaseTI("tTypeInfoInterface",18 /* tkInterface */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoHelper",19 /* tkHelper */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoExtClass",20 /* tkExtClass */,rtl.tTypeInfoClass);
  },

  tSectionRTTI: {
    $module: null,
    $inherited: function(name,ancestor,o){
      if (rtl.debug_rtti){
        rtl.debug('tSectionRTTI.newTI "'+(this.$module?this.$module.$name:"(no module)")
          +'"."'+name+'" ('+ancestor.name+') '+(o?'init':'forward'));
      };
      var t = this[name];
      if (t){
        if (!t.$forward) throw 'duplicate type "'+name+'"';
        if (!ancestor.isPrototypeOf(t)) throw 'typeinfo ancestor mismatch "'+name+'" ancestor="'+ancestor.name+'" t.name="'+t.name+'"';
      } else {
        t = Object.create(ancestor);
        t.name = name;
        t.$module = this.$module;
        this[name] = t;
      }
      if (o){
        delete t.$forward;
        for (var key in o) if (o.hasOwnProperty(key)) t[key]=o[key];
      } else {
        t.$forward = true;
      }
      return t;
    },
    $Scope: function(name,ancestor,o){
      var t=this.$inherited(name,ancestor,o);
      t.members = {};
      t.names = [];
      t.fields = [];
      t.methods = [];
      t.properties = [];
      return t;
    },
    $TI: function(name,kind,o){ var t=this.$inherited(name,rtl.tTypeInfo,o); t.kind = kind; return t; },
    $Int: function(name,o){ return this.$inherited(name,rtl.tTypeInfoInteger,o); },
    $Enum: function(name,o){ return this.$inherited(name,rtl.tTypeInfoEnum,o); },
    $Set: function(name,o){ return this.$inherited(name,rtl.tTypeInfoSet,o); },
    $StaticArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoArray,o); },
    $DynArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoDynArray,o); },
    $ProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoProcVar,o); },
    $RefToProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoRefToProcVar,o); },
    $MethodVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoMethodVar,o); },
    $Record: function(name,o){ return this.$Scope(name,rtl.tTypeInfoRecord,o); },
    $Class: function(name,o){ return this.$Scope(name,rtl.tTypeInfoClass,o); },
    $ClassRef: function(name,o){ return this.$inherited(name,rtl.tTypeInfoClassRef,o); },
    $Pointer: function(name,o){ return this.$inherited(name,rtl.tTypeInfoPointer,o); },
    $Interface: function(name,o){ return this.$Scope(name,rtl.tTypeInfoInterface,o); },
    $Helper: function(name,o){ return this.$Scope(name,rtl.tTypeInfoHelper,o); },
    $ExtClass: function(name,o){ return this.$Scope(name,rtl.tTypeInfoExtClass,o); }
  },

  newTIParam: function(param){
    // param is an array, 0=name, 1=type, 2=optional flags
    var t = {
      name: param[0],
      typeinfo: param[1],
      flags: (rtl.isNumber(param[2]) ? param[2] : 0)
    };
    return t;
  },

  newTIParams: function(list){
    // list: optional array of [paramname,typeinfo,optional flags]
    var params = [];
    if (rtl.isArray(list)){
      for (var i=0; i<list.length; i++) params.push(rtl.newTIParam(list[i]));
    };
    return params;
  },

  newTIProcSig: function(params,result,flags){
    var s = {
      params: rtl.newTIParams(params),
      resulttype: result?result:null,
      flags: flags?flags:0
    };
    return s;
  },

  addResource: function(aRes){
    rtl.$res[aRes.name]=aRes;
  },

  getResource: function(aName){
    var res = rtl.$res[aName];
    if (res !== undefined) {
      return res;
    } else {
      return null;
    }
  },

  getResourceList: function(){
    return Object.keys(rtl.$res);
  }
}

rtl.module("System",[],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.MaxLongint = 0x7fffffff;
  this.Maxint = 2147483647;
  rtl.createClass(this,"TObject",null,function () {
    this.$init = function () {
    };
    this.$final = function () {
    };
    this.Create = function () {
      return this;
    };
    this.Destroy = function () {
    };
    this.Free = function () {
      this.$destroy("Destroy");
    };
    this.FieldAddress = function (aName) {
      var Result = null;
      Result = null;
      if (aName === "") return Result;
      var aClass = this.$class;
      var ClassTI = null;
      var myName = aName.toLowerCase();
      var MemberTI = null;
      while (aClass !== null) {
        ClassTI = aClass.$rtti;
        for (var i = 0, $end2 = ClassTI.fields.length - 1; i <= $end2; i++) {
          MemberTI = ClassTI.getField(i);
          if (MemberTI.name.toLowerCase() === myName) {
             return MemberTI;
          };
        };
        aClass = aClass.$ancestor ? aClass.$ancestor : null;
      };
      return Result;
    };
    this.AfterConstruction = function () {
    };
    this.BeforeDestruction = function () {
    };
  });
  this.vtInteger = 0;
  this.vtExtended = 3;
  this.vtWideChar = 9;
  this.vtCurrency = 12;
  this.vtUnicodeString = 18;
  this.vtNativeInt = 19;
  rtl.recNewT(this,"TVarRec",function () {
    this.VType = 0;
    this.VJSValue = undefined;
    this.$eq = function (b) {
      return (this.VType === b.VType) && (this.VJSValue === b.VJSValue) && (this.VJSValue === b.VJSValue) && (this.VJSValue === b.VJSValue) && (this.VJSValue === b.VJSValue) && (this.VJSValue === b.VJSValue) && (this.VJSValue === b.VJSValue) && (this.VJSValue === b.VJSValue);
    };
    this.$assign = function (s) {
      this.VType = s.VType;
      this.VJSValue = s.VJSValue;
      this.VJSValue = s.VJSValue;
      this.VJSValue = s.VJSValue;
      this.VJSValue = s.VJSValue;
      this.VJSValue = s.VJSValue;
      this.VJSValue = s.VJSValue;
      this.VJSValue = s.VJSValue;
      return this;
    };
  });
  this.VarRecs = function () {
    var Result = [];
    var i = 0;
    var v = null;
    Result = [];
    while (i < arguments.length) {
      v = $mod.TVarRec.$new();
      v.VType = rtl.trunc(arguments[i]);
      i += 1;
      v.VJSValue = arguments[i];
      i += 1;
      Result.push($mod.TVarRec.$clone(v));
    };
    return Result;
  };
  this.IsConsole = false;
  this.OnParamCount = null;
  this.OnParamStr = null;
  this.Frac = function (A) {
    return A % 1;
  };
  this.Trunc = function (A) {
    if (!Math.trunc) {
      Math.trunc = function(v) {
        v = +v;
        if (!isFinite(v)) return v;
        return (v - v % 1) || (v < 0 ? -0 : v === 0 ? v : 0);
      };
    }
    $mod.Trunc = Math.trunc;
    return Math.trunc(A);
  };
  this.Int = function (A) {
    var Result = 0.0;
    Result = $mod.Trunc(A);
    return Result;
  };
  this.Copy = function (S, Index, Size) {
    if (Index<1) Index = 1;
    return (Size>0) ? S.substring(Index-1,Index+Size-1) : "";
  };
  this.Copy$1 = function (S, Index) {
    if (Index<1) Index = 1;
    return S.substr(Index-1);
  };
  this.Delete = function (S, Index, Size) {
    var h = "";
    if ((Index < 1) || (Index > S.get().length) || (Size <= 0)) return;
    h = S.get();
    S.set($mod.Copy(h,1,Index - 1) + $mod.Copy$1(h,Index + Size));
  };
  this.Pos = function (Search, InString) {
    return InString.indexOf(Search)+1;
  };
  this.Insert = function (Insertion, Target, Index) {
    var t = "";
    if (Insertion === "") return;
    t = Target.get();
    if (Index < 1) {
      Target.set(Insertion + t)}
     else if (Index > t.length) {
      Target.set(t + Insertion)}
     else Target.set($mod.Copy(t,1,Index - 1) + Insertion + $mod.Copy(t,Index,t.length));
  };
  this.upcase = function (c) {
    return c.toUpperCase();
  };
  this.val = function (S, NI, Code) {
    NI.set($impl.valint(S,-9007199254740991,9007199254740991,Code));
  };
  this.val$6 = function (S, I, Code) {
    I.set($impl.valint(S,-2147483648,2147483647,Code));
  };
  this.val$8 = function (S, d, Code) {
    var x = 0.0;
    if (S === "") {
      Code.set(1);
      return;
    };
    x = Number(S);
    if (isNaN(x)) {
      Code.set(1)}
     else {
      Code.set(0);
      d.set(x);
    };
  };
  this.StringOfChar = function (c, l) {
    var Result = "";
    var i = 0;
    if ((l>0) && c.repeat) return c.repeat(l);
    Result = "";
    for (var $l = 1, $end = l; $l <= $end; $l++) {
      i = $l;
      Result = Result + c;
    };
    return Result;
  };
  this.Writeln = function () {
    var i = 0;
    var l = 0;
    var s = "";
    l = arguments.length - 1;
    if ($impl.WriteCallBack != null) {
      for (var $l = 0, $end = l; $l <= $end; $l++) {
        i = $l;
        $impl.WriteCallBack(arguments[i],i === l);
      };
    } else {
      s = $impl.WriteBuf;
      for (var $l1 = 0, $end1 = l; $l1 <= $end1; $l1++) {
        i = $l1;
        s = s + ("" + arguments[i]);
      };
      console.log(s);
      $impl.WriteBuf = "";
    };
  };
  this.Assigned = function (V) {
    return (V!=undefined) && (V!=null) && (!rtl.isArray(V) || (V.length > 0));
  };
  $mod.$implcode = function () {
    $impl.WriteBuf = "";
    $impl.WriteCallBack = null;
    $impl.valint = function (S, MinVal, MaxVal, Code) {
      var Result = 0;
      var x = 0.0;
      if (S === "") {
        Code.set(1);
        return Result;
      };
      x = Number(S);
      if (isNaN(x)) {
        var $tmp = $mod.Copy(S,1,1);
        if ($tmp === "$") {
          x = Number("0x" + $mod.Copy$1(S,2))}
         else if ($tmp === "&") {
          x = Number("0o" + $mod.Copy$1(S,2))}
         else if ($tmp === "%") {
          x = Number("0b" + $mod.Copy$1(S,2))}
         else {
          Code.set(1);
          return Result;
        };
      };
      if (isNaN(x) || (x !== $mod.Int(x))) {
        Code.set(1)}
       else if ((x < MinVal) || (x > MaxVal)) {
        Code.set(2)}
       else {
        Result = $mod.Trunc(x);
        Code.set(0);
      };
      return Result;
    };
  };
  $mod.$init = function () {
    rtl.exitcode = 0;
  };
},[]);
rtl.module("RTLConsts",["System"],function () {
  "use strict";
  var $mod = this;
  $mod.$resourcestrings = {SArgumentMissing: {org: 'Missing argument in format "%s"'}, SInvalidFormat: {org: 'Invalid format specifier : "%s"'}, SInvalidArgIndex: {org: 'Invalid argument index in format: "%s"'}, SListCapacityError: {org: "List capacity (%s) exceeded."}, SListCountError: {org: "List count (%s) out of bounds."}, SListIndexError: {org: "List index (%s) out of bounds"}, SInvalidName: {org: 'Invalid component name: "%s"'}, SDuplicateName: {org: 'Duplicate component name: "%s"'}, SErrInvalidDate: {org: 'Invalid date: "%s"'}, SInvalidDateFormat: {org: 'Invalid date format: "%s"'}, SErrInvalidInteger: {org: 'Invalid integer value: "%s"'}, SErrInvalidTimeStamp: {org: 'Invalid date/timestamp : "%s"'}};
});
rtl.module("Types",["System"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("JS",["System","Types"],function () {
  "use strict";
  var $mod = this;
  this.hasValue = function (v) {
    if(v){ return true; } else { return false; };
  };
  this.isBoolean = function (v) {
    return typeof(v) == 'boolean';
  };
  this.isInteger = function (v) {
    return Math.floor(v)===v;
  };
  this.toNumber = function (v) {
    return v-0;
  };
  this.toInteger = function (v) {
    var Result = 0;
    if ($mod.isInteger(v)) {
      Result = rtl.trunc(v)}
     else Result = 0;
    return Result;
  };
  this.toBoolean = function (Value) {
    var Result = false;
    if ($mod.isBoolean(Value)) {
      Result = !(Value == false)}
     else Result = false;
    return Result;
  };
  this.ToString = function (Value) {
    var Result = "";
    if (rtl.isString(Value)) {
      Result = "" + Value}
     else Result = "";
    return Result;
  };
});
rtl.module("SysUtils",["System","RTLConsts","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.FreeAndNil = function (Obj) {
    var o = null;
    o = Obj.get();
    if (o === null) return;
    Obj.set(null);
    o.$destroy("Destroy");
  };
  rtl.recNewT(this,"TFormatSettings",function () {
    this.CurrencyDecimals = 0;
    this.CurrencyFormat = 0;
    this.CurrencyString = "";
    this.DateSeparator = "\x00";
    this.DecimalSeparator = "";
    this.LongDateFormat = "";
    this.LongTimeFormat = "";
    this.NegCurrFormat = 0;
    this.ShortDateFormat = "";
    this.ShortTimeFormat = "";
    this.ThousandSeparator = "";
    this.TimeAMString = "";
    this.TimePMString = "";
    this.TimeSeparator = "\x00";
    this.TwoDigitYearCenturyWindow = 0;
    this.InitLocaleHandler = null;
    this.$new = function () {
      var r = Object.create(this);
      r.DateTimeToStrFormat = rtl.arraySetLength(null,"",2);
      r.LongDayNames = rtl.arraySetLength(null,"",7);
      r.LongMonthNames = rtl.arraySetLength(null,"",12);
      r.ShortDayNames = rtl.arraySetLength(null,"",7);
      r.ShortMonthNames = rtl.arraySetLength(null,"",12);
      return r;
    };
    this.$eq = function (b) {
      return (this.CurrencyDecimals === b.CurrencyDecimals) && (this.CurrencyFormat === b.CurrencyFormat) && (this.CurrencyString === b.CurrencyString) && (this.DateSeparator === b.DateSeparator) && rtl.arrayEq(this.DateTimeToStrFormat,b.DateTimeToStrFormat) && (this.DecimalSeparator === b.DecimalSeparator) && (this.LongDateFormat === b.LongDateFormat) && rtl.arrayEq(this.LongDayNames,b.LongDayNames) && rtl.arrayEq(this.LongMonthNames,b.LongMonthNames) && (this.LongTimeFormat === b.LongTimeFormat) && (this.NegCurrFormat === b.NegCurrFormat) && (this.ShortDateFormat === b.ShortDateFormat) && rtl.arrayEq(this.ShortDayNames,b.ShortDayNames) && rtl.arrayEq(this.ShortMonthNames,b.ShortMonthNames) && (this.ShortTimeFormat === b.ShortTimeFormat) && (this.ThousandSeparator === b.ThousandSeparator) && (this.TimeAMString === b.TimeAMString) && (this.TimePMString === b.TimePMString) && (this.TimeSeparator === b.TimeSeparator) && (this.TwoDigitYearCenturyWindow === b.TwoDigitYearCenturyWindow);
    };
    this.$assign = function (s) {
      this.CurrencyDecimals = s.CurrencyDecimals;
      this.CurrencyFormat = s.CurrencyFormat;
      this.CurrencyString = s.CurrencyString;
      this.DateSeparator = s.DateSeparator;
      this.DateTimeToStrFormat = s.DateTimeToStrFormat.slice(0);
      this.DecimalSeparator = s.DecimalSeparator;
      this.LongDateFormat = s.LongDateFormat;
      this.LongDayNames = s.LongDayNames.slice(0);
      this.LongMonthNames = s.LongMonthNames.slice(0);
      this.LongTimeFormat = s.LongTimeFormat;
      this.NegCurrFormat = s.NegCurrFormat;
      this.ShortDateFormat = s.ShortDateFormat;
      this.ShortDayNames = s.ShortDayNames.slice(0);
      this.ShortMonthNames = s.ShortMonthNames.slice(0);
      this.ShortTimeFormat = s.ShortTimeFormat;
      this.ThousandSeparator = s.ThousandSeparator;
      this.TimeAMString = s.TimeAMString;
      this.TimePMString = s.TimePMString;
      this.TimeSeparator = s.TimeSeparator;
      this.TwoDigitYearCenturyWindow = s.TwoDigitYearCenturyWindow;
      return this;
    };
    this.GetJSLocale = function () {
      return Intl.DateTimeFormat().resolvedOptions().locale;
    };
    this.Create = function () {
      var Result = $mod.TFormatSettings.$new();
      Result.$assign($mod.TFormatSettings.Create$1($mod.TFormatSettings.GetJSLocale()));
      return Result;
    };
    this.Create$1 = function (ALocale) {
      var Result = $mod.TFormatSettings.$new();
      Result.LongDayNames = $impl.DefaultLongDayNames.slice(0);
      Result.ShortDayNames = $impl.DefaultShortDayNames.slice(0);
      Result.ShortMonthNames = $impl.DefaultShortMonthNames.slice(0);
      Result.LongMonthNames = $impl.DefaultLongMonthNames.slice(0);
      Result.DateTimeToStrFormat[0] = "c";
      Result.DateTimeToStrFormat[1] = "f";
      Result.DateSeparator = "-";
      Result.TimeSeparator = ":";
      Result.ShortDateFormat = "yyyy-mm-dd";
      Result.LongDateFormat = "ddd, yyyy-mm-dd";
      Result.ShortTimeFormat = "hh:nn";
      Result.LongTimeFormat = "hh:nn:ss";
      Result.DecimalSeparator = ".";
      Result.ThousandSeparator = ",";
      Result.TimeAMString = "AM";
      Result.TimePMString = "PM";
      Result.TwoDigitYearCenturyWindow = 50;
      Result.CurrencyFormat = 0;
      Result.NegCurrFormat = 0;
      Result.CurrencyDecimals = 2;
      Result.CurrencyString = "$";
      if ($mod.TFormatSettings.InitLocaleHandler != null) $mod.TFormatSettings.InitLocaleHandler($mod.UpperCase(ALocale),$mod.TFormatSettings.$clone(Result));
      return Result;
    };
  },true);
  rtl.createClass(this,"Exception",pas.System.TObject,function () {
    this.LogMessageOnCreate = false;
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fMessage = "";
    };
    this.Create$1 = function (Msg) {
      this.fMessage = Msg;
      if (this.LogMessageOnCreate) pas.System.Writeln("Created exception ",this.$classname," with message: ",Msg);
      return this;
    };
    this.CreateFmt = function (Msg, Args) {
      this.Create$1($mod.Format(Msg,Args));
      return this;
    };
  });
  rtl.createClass(this,"EExternal",this.Exception,function () {
  });
  rtl.createClass(this,"EConvertError",this.Exception,function () {
  });
  rtl.createClass(this,"EExternalException",this.EExternal,function () {
  });
  this.CharInSet = function (Ch, CSet) {
    var Result = false;
    var I = 0;
    Result = false;
    I = rtl.length(CSet) - 1;
    while (!Result && (I >= 0)) {
      Result = Ch === CSet[I];
      I -= 1;
    };
    return Result;
  };
  this.Trim = function (S) {
    return S.replace(/^[\s\uFEFF\xA0\x00-\x1f]+/,'').replace(/[\s\uFEFF\xA0\x00-\x1f]+$/,'');
  };
  this.TrimLeft = function (S) {
    return S.replace(/^[\s\uFEFF\xA0\x00-\x1f]+/,'');
  };
  this.UpperCase = function (s) {
    return s.toUpperCase();
  };
  this.LowerCase = function (s) {
    return s.toLowerCase();
  };
  this.CompareText = function (s1, s2) {
    var l1 = s1.toLowerCase();
    var l2 = s2.toLowerCase();
    if (l1>l2){ return 1;
    } else if (l1<l2){ return -1;
    } else { return 0; };
  };
  this.Format = function (Fmt, Args) {
    var Result = "";
    Result = $mod.Format$1(Fmt,Args,$mod.FormatSettings);
    return Result;
  };
  this.Format$1 = function (Fmt, Args, aSettings) {
    var Result = "";
    var ChPos = 0;
    var OldPos = 0;
    var ArgPos = 0;
    var DoArg = 0;
    var Len = 0;
    var Hs = "";
    var ToAdd = "";
    var Index = 0;
    var Width = 0;
    var Prec = 0;
    var Left = false;
    var Fchar = "\x00";
    var vq = 0;
    function ReadFormat() {
      var Result = "\x00";
      var Value = 0;
      function ReadInteger() {
        var Code = 0;
        var ArgN = 0;
        if (Value !== -1) return;
        OldPos = ChPos;
        while ((ChPos <= Len) && (Fmt.charAt(ChPos - 1) <= "9") && (Fmt.charAt(ChPos - 1) >= "0")) ChPos += 1;
        if (ChPos > Len) $impl.DoFormatError(1,Fmt);
        if (Fmt.charAt(ChPos - 1) === "*") {
          if (Index === 255) {
            ArgN = ArgPos}
           else {
            ArgN = Index;
            Index += 1;
          };
          if ((ChPos > OldPos) || (ArgN > (rtl.length(Args) - 1))) $impl.DoFormatError(1,Fmt);
          ArgPos = ArgN + 1;
          var $tmp = Args[ArgN].VType;
          if ($tmp === 0) {
            Value = Args[ArgN].VJSValue}
           else if ($tmp === 19) {
            Value = Args[ArgN].VJSValue}
           else {
            $impl.DoFormatError(1,Fmt);
          };
          ChPos += 1;
        } else {
          if (OldPos < ChPos) {
            pas.System.val(pas.System.Copy(Fmt,OldPos,ChPos - OldPos),{get: function () {
                return Value;
              }, set: function (v) {
                Value = v;
              }},{get: function () {
                return Code;
              }, set: function (v) {
                Code = v;
              }});
            if (Code > 0) $impl.DoFormatError(1,Fmt);
          } else Value = -1;
        };
      };
      function ReadIndex() {
        if (Fmt.charAt(ChPos - 1) !== ":") {
          ReadInteger()}
         else Value = 0;
        if (Fmt.charAt(ChPos - 1) === ":") {
          if (Value === -1) $impl.DoFormatError(2,Fmt);
          Index = Value;
          Value = -1;
          ChPos += 1;
        };
      };
      function ReadLeft() {
        if (Fmt.charAt(ChPos - 1) === "-") {
          Left = true;
          ChPos += 1;
        } else Left = false;
      };
      function ReadWidth() {
        ReadInteger();
        if (Value !== -1) {
          Width = Value;
          Value = -1;
        };
      };
      function ReadPrec() {
        if (Fmt.charAt(ChPos - 1) === ".") {
          ChPos += 1;
          ReadInteger();
          if (Value === -1) Value = 0;
          Prec = Value;
        };
      };
      Index = 255;
      Width = -1;
      Prec = -1;
      Value = -1;
      ChPos += 1;
      if (Fmt.charAt(ChPos - 1) === "%") {
        Result = "%";
        return Result;
      };
      ReadIndex();
      ReadLeft();
      ReadWidth();
      ReadPrec();
      Result = pas.System.upcase(Fmt.charAt(ChPos - 1));
      return Result;
    };
    function Checkarg(AT, err) {
      var Result = false;
      Result = false;
      if (Index === 255) {
        DoArg = ArgPos}
       else DoArg = Index;
      ArgPos = DoArg + 1;
      if ((DoArg > (rtl.length(Args) - 1)) || (Args[DoArg].VType !== AT)) {
        if (err) $impl.DoFormatError(3,Fmt);
        ArgPos -= 1;
        return Result;
      };
      Result = true;
      return Result;
    };
    Result = "";
    Len = Fmt.length;
    ChPos = 1;
    OldPos = 1;
    ArgPos = 0;
    while (ChPos <= Len) {
      while ((ChPos <= Len) && (Fmt.charAt(ChPos - 1) !== "%")) ChPos += 1;
      if (ChPos > OldPos) Result = Result + pas.System.Copy(Fmt,OldPos,ChPos - OldPos);
      if (ChPos < Len) {
        Fchar = ReadFormat();
        var $tmp = Fchar;
        if ($tmp === "D") {
          if (Checkarg(0,false)) {
            ToAdd = $mod.IntToStr(Args[DoArg].VJSValue)}
           else if (Checkarg(19,true)) ToAdd = $mod.IntToStr(Args[DoArg].VJSValue);
          Width = Math.abs(Width);
          Index = Prec - ToAdd.length;
          if (ToAdd.charAt(0) !== "-") {
            ToAdd = pas.System.StringOfChar("0",Index) + ToAdd}
           else pas.System.Insert(pas.System.StringOfChar("0",Index + 1),{get: function () {
              return ToAdd;
            }, set: function (v) {
              ToAdd = v;
            }},2);
        } else if ($tmp === "U") {
          if (Checkarg(0,false)) {
            ToAdd = $mod.IntToStr(Args[DoArg].VJSValue >>> 0)}
           else if (Checkarg(19,true)) ToAdd = $mod.IntToStr(Args[DoArg].VJSValue);
          Width = Math.abs(Width);
          Index = Prec - ToAdd.length;
          ToAdd = pas.System.StringOfChar("0",Index) + ToAdd;
        } else if ($tmp === "E") {
          if (Checkarg(12,false)) {
            ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue / 10000,2,3,Prec,aSettings)}
           else if (Checkarg(3,true)) ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue,2,3,Prec,aSettings);
        } else if ($tmp === "F") {
          if (Checkarg(12,false)) {
            ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue / 10000,0,9999,Prec,aSettings)}
           else if (Checkarg(3,true)) ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue,0,9999,Prec,aSettings);
        } else if ($tmp === "G") {
          if (Checkarg(12,false)) {
            ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue / 10000,1,Prec,3,aSettings)}
           else if (Checkarg(3,true)) ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue,1,Prec,3,aSettings);
        } else if ($tmp === "N") {
          if (Checkarg(12,false)) {
            ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue / 10000,3,9999,Prec,aSettings)}
           else if (Checkarg(3,true)) ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue,3,9999,Prec,aSettings);
        } else if ($tmp === "M") {
          if (Checkarg(12,false)) {
            ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue / 10000,4,9999,Prec,aSettings)}
           else if (Checkarg(3,true)) ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue,4,9999,Prec,aSettings);
        } else if ($tmp === "S") {
          if (Checkarg(18,false)) {
            Hs = Args[DoArg].VJSValue}
           else if (Checkarg(9,true)) Hs = Args[DoArg].VJSValue;
          Index = Hs.length;
          if ((Prec !== -1) && (Index > Prec)) Index = Prec;
          ToAdd = pas.System.Copy(Hs,1,Index);
        } else if ($tmp === "P") {
          if (Checkarg(0,false)) {
            ToAdd = $mod.IntToHex(Args[DoArg].VJSValue,8)}
           else if (Checkarg(0,true)) ToAdd = $mod.IntToHex(Args[DoArg].VJSValue,16);
        } else if ($tmp === "X") {
          if (Checkarg(0,false)) {
            vq = Args[DoArg].VJSValue;
            Index = 16;
          } else if (Checkarg(19,true)) {
            vq = Args[DoArg].VJSValue;
            Index = 31;
          };
          if (Prec > Index) {
            ToAdd = $mod.IntToHex(vq,Index)}
           else {
            Index = 1;
            while ((rtl.shl(1,Index * 4) <= vq) && (Index < 16)) Index += 1;
            if (Index > Prec) Prec = Index;
            ToAdd = $mod.IntToHex(vq,Prec);
          };
        } else if ($tmp === "%") ToAdd = "%";
        if (Width !== -1) if (ToAdd.length < Width) if (!Left) {
          ToAdd = pas.System.StringOfChar(" ",Width - ToAdd.length) + ToAdd}
         else ToAdd = ToAdd + pas.System.StringOfChar(" ",Width - ToAdd.length);
        Result = Result + ToAdd;
      };
      ChPos += 1;
      OldPos = ChPos;
    };
    return Result;
  };
  var Alpha = rtl.createSet(null,65,90,null,97,122,95);
  var AlphaNum = rtl.unionSet(Alpha,rtl.createSet(null,48,57));
  var Dot = ".";
  this.IsValidIdent = function (Ident, AllowDots, StrictDots) {
    var Result = false;
    var First = false;
    var I = 0;
    var Len = 0;
    Len = Ident.length;
    if (Len < 1) return false;
    First = true;
    Result = false;
    I = 1;
    while (I <= Len) {
      if (First) {
        if (!(Ident.charCodeAt(I - 1) in Alpha)) return Result;
        First = false;
      } else if (AllowDots && (Ident.charAt(I - 1) === Dot)) {
        if (StrictDots) {
          if (I >= Len) return Result;
          First = true;
        };
      } else if (!(Ident.charCodeAt(I - 1) in AlphaNum)) return Result;
      I = I + 1;
    };
    Result = true;
    return Result;
  };
  this.IntToStr = function (Value) {
    var Result = "";
    Result = "" + Value;
    return Result;
  };
  this.TryStrToInt = function (S, res) {
    var Result = false;
    var NI = 0;
    Result = $mod.TryStrToInt$2(S,{get: function () {
        return NI;
      }, set: function (v) {
        NI = v;
      }});
    Result = Result && (-2147483648 <= NI) && (NI <= 2147483647);
    if (Result) res.set(NI);
    return Result;
  };
  this.TryStrToInt$2 = function (S, res) {
    var Result = false;
    Result = $impl.IntTryStrToInt(S,res,$mod.FormatSettings.DecimalSeparator);
    return Result;
  };
  this.StrToIntDef = function (S, aDef) {
    var Result = 0;
    var R = 0;
    if ($mod.TryStrToInt$2(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }})) {
      Result = R}
     else Result = aDef;
    return Result;
  };
  this.StrToInt = function (S) {
    var Result = 0;
    var R = 0;
    if (!$mod.TryStrToInt$2(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SErrInvalidInteger"),pas.System.VarRecs(18,S)]);
    Result = R;
    return Result;
  };
  this.TryStrToInt64 = function (S, res) {
    var Result = false;
    var R = 0;
    Result = $mod.TryStrToInt$2(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }});
    if (Result) res.set(R);
    return Result;
  };
  this.TryStrToInt64$1 = function (S, res) {
    var Result = false;
    Result = $mod.TryStrToInt64(S,res);
    return Result;
  };
  this.IntToHex = function (Value, Digits) {
    var Result = "";
    Result = "";
    if (Value < 0) if (Value<0) Value = 0xFFFFFFFF + Value + 1;
    Result=Value.toString(16);
    Result = $mod.UpperCase(Result);
    while (Result.length < Digits) Result = "0" + Result;
    return Result;
  };
  this.TFloatFormat = {"0": "ffFixed", ffFixed: 0, "1": "ffGeneral", ffGeneral: 1, "2": "ffExponent", ffExponent: 2, "3": "ffNumber", ffNumber: 3, "4": "ffCurrency", ffCurrency: 4};
  this.FloatToStr = function (Value) {
    var Result = "";
    Result = $mod.FloatToStr$1(Value,$mod.FormatSettings);
    return Result;
  };
  this.FloatToStr$1 = function (Value, aSettings) {
    var Result = "";
    Result = $mod.FloatToStrF$1(Value,1,15,0,aSettings);
    return Result;
  };
  this.FloatToStrF$1 = function (Value, format, Precision, Digits, aSettings) {
    var Result = "";
    var TS = "";
    var DS = "";
    DS = aSettings.DecimalSeparator;
    TS = aSettings.ThousandSeparator;
    var $tmp = format;
    if ($tmp === 1) {
      Result = $impl.FormatGeneralFloat(Value,Precision,DS)}
     else if ($tmp === 2) {
      Result = $impl.FormatExponentFloat(Value,Precision,Digits,DS)}
     else if ($tmp === 0) {
      Result = $impl.FormatFixedFloat(Value,Digits,DS)}
     else if ($tmp === 3) {
      Result = $impl.FormatNumberFloat(Value,Digits,DS,TS)}
     else if ($tmp === 4) Result = $impl.FormatNumberCurrency(Value * 10000,Digits,aSettings);
    if ((format !== 4) && (Result.length > 1) && (Result.charAt(0) === "-")) $impl.RemoveLeadingNegativeSign({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},DS,TS);
    return Result;
  };
  this.OnGetEnvironmentVariable = null;
  this.OnGetEnvironmentString = null;
  this.OnGetEnvironmentVariableCount = null;
  rtl.recNewT(this,"TTimeStamp",function () {
    this.Time = 0;
    this.Date = 0;
    this.$eq = function (b) {
      return (this.Time === b.Time) && (this.Date === b.Date);
    };
    this.$assign = function (s) {
      this.Time = s.Time;
      this.Date = s.Date;
      return this;
    };
  });
  this.TimeSeparator = "\x00";
  this.DateSeparator = "\x00";
  this.ShortDateFormat = "";
  this.LongDateFormat = "";
  this.ShortTimeFormat = "";
  this.LongTimeFormat = "";
  this.DecimalSeparator = "";
  this.ThousandSeparator = "";
  this.TimeAMString = "";
  this.TimePMString = "";
  this.HoursPerDay = 24;
  this.MinsPerHour = 60;
  this.SecsPerMin = 60;
  this.MSecsPerSec = 1000;
  this.MinsPerDay = 24 * 60;
  this.SecsPerDay = 1440 * 60;
  this.MSecsPerDay = 86400 * 1000;
  this.MaxDateTime = 2958465.99999999;
  this.DateDelta = 693594;
  this.MonthDays$a$clone = function (a) {
    var b = [];
    b.length = 2;
    for (var c = 0; c < 2; c++) b[c] = a[c].slice(0);
    return b;
  };
  this.MonthDays = [[31,28,31,30,31,30,31,31,30,31,30,31],[31,29,31,30,31,30,31,31,30,31,30,31]];
  this.ShortMonthNames = rtl.arraySetLength(null,"",12);
  this.LongMonthNames = rtl.arraySetLength(null,"",12);
  this.ShortDayNames = rtl.arraySetLength(null,"",7);
  this.LongDayNames = rtl.arraySetLength(null,"",7);
  this.FormatSettings = this.TFormatSettings.$new();
  this.TwoDigitYearCenturyWindow = 50;
  this.DateTimeToJSDate = function (aDateTime, asUTC) {
    var Result = null;
    var Y = 0;
    var M = 0;
    var D = 0;
    var h = 0;
    var n = 0;
    var s = 0;
    var z = 0;
    $mod.DecodeDate(pas.System.Trunc(aDateTime),{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }});
    $mod.DecodeTime(pas.System.Frac(aDateTime),{get: function () {
        return h;
      }, set: function (v) {
        h = v;
      }},{get: function () {
        return n;
      }, set: function (v) {
        n = v;
      }},{get: function () {
        return s;
      }, set: function (v) {
        s = v;
      }},{get: function () {
        return z;
      }, set: function (v) {
        z = v;
      }});
    if (asUTC) {
      Result = new Date(Date.UTC(Y,M - 1,D,h,n,s,z))}
     else Result = new Date(Y,M - 1,D,h,n,s,z);
    return Result;
  };
  this.JSDateToDateTime = function (aDate) {
    var Result = 0.0;
    Result = $mod.EncodeDate(aDate.getFullYear(),aDate.getMonth() + 1,aDate.getDate()) + $mod.EncodeTime(aDate.getHours(),aDate.getMinutes(),aDate.getSeconds(),aDate.getMilliseconds());
    return Result;
  };
  this.DateTimeToTimeStamp = function (DateTime) {
    var Result = $mod.TTimeStamp.$new();
    var D = 0.0;
    D = DateTime * 86400000;
    if (D < 0) {
      D = D - 0.5}
     else D = D + 0.5;
    Result.Time = pas.System.Trunc(Math.abs(pas.System.Trunc(D)) % 86400000);
    Result.Date = 693594 + rtl.trunc(pas.System.Trunc(D) / 86400000);
    return Result;
  };
  this.TryEncodeDate = function (Year, Month, Day, date) {
    var Result = false;
    var c = 0;
    var ya = 0;
    Result = (Year > 0) && (Year < 10000) && (Month >= 1) && (Month <= 12) && (Day > 0) && (Day <= $mod.MonthDays[+$mod.IsLeapYear(Year)][Month - 1]);
    if (Result) {
      if (Month > 2) {
        Month -= 3}
       else {
        Month += 9;
        Year -= 1;
      };
      c = rtl.trunc(Year / 100);
      ya = Year - (100 * c);
      date.set(((146097 * c) >>> 2) + ((1461 * ya) >>> 2) + rtl.trunc(((153 * Month) + 2) / 5) + Day);
      date.set(date.get() - 693900);
    };
    return Result;
  };
  this.TryEncodeTime = function (Hour, Min, Sec, MSec, Time) {
    var Result = false;
    Result = (Hour < 24) && (Min < 60) && (Sec < 60) && (MSec < 1000);
    if (Result) Time.set(((Hour * 3600000) + (Min * 60000) + (Sec * 1000) + MSec) / 86400000);
    return Result;
  };
  this.EncodeDate = function (Year, Month, Day) {
    var Result = 0.0;
    if (!$mod.TryEncodeDate(Year,Month,Day,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",["%s-%s-%s is not a valid date specification",pas.System.VarRecs(18,$mod.IntToStr(Year),18,$mod.IntToStr(Month),18,$mod.IntToStr(Day))]);
    return Result;
  };
  this.EncodeTime = function (Hour, Minute, Second, MilliSecond) {
    var Result = 0.0;
    if (!$mod.TryEncodeTime(Hour,Minute,Second,MilliSecond,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",["%s:%s:%s.%s is not a valid time specification",pas.System.VarRecs(18,$mod.IntToStr(Hour),18,$mod.IntToStr(Minute),18,$mod.IntToStr(Second),18,$mod.IntToStr(MilliSecond))]);
    return Result;
  };
  this.DecodeDate = function (date, Year, Month, Day) {
    var ly = 0;
    var ld = 0;
    var lm = 0;
    var j = 0;
    if (date <= -693594) {
      Year.set(0);
      Month.set(0);
      Day.set(0);
    } else {
      if (date > 0) {
        date = date + (1 / (86400000 * 2))}
       else date = date - (1 / (86400000 * 2));
      if (date > $mod.MaxDateTime) date = $mod.MaxDateTime;
      j = rtl.shl(pas.System.Trunc(date) + 693900,2) - 1;
      ly = rtl.trunc(j / 146097);
      j = j - (146097 * ly);
      ld = rtl.lw(j >>> 2);
      j = rtl.trunc((rtl.lw(ld << 2) + 3) / 1461);
      ld = rtl.lw(((rtl.lw(ld << 2) + 7) - (1461 * j)) >>> 2);
      lm = rtl.trunc(((5 * ld) - 3) / 153);
      ld = rtl.trunc((((5 * ld) + 2) - (153 * lm)) / 5);
      ly = (100 * ly) + j;
      if (lm < 10) {
        lm += 3}
       else {
        lm -= 9;
        ly += 1;
      };
      Year.set(ly);
      Month.set(lm);
      Day.set(ld);
    };
  };
  this.DecodeTime = function (Time, Hour, Minute, Second, MilliSecond) {
    var l = 0;
    l = $mod.DateTimeToTimeStamp(Time).Time;
    Hour.set(rtl.trunc(l / 3600000));
    l = l % 3600000;
    Minute.set(rtl.trunc(l / 60000));
    l = l % 60000;
    Second.set(rtl.trunc(l / 1000));
    l = l % 1000;
    MilliSecond.set(l);
  };
  this.DecodeDateFully = function (DateTime, Year, Month, Day, DOW) {
    var Result = false;
    $mod.DecodeDate(DateTime,Year,Month,Day);
    DOW.set($mod.DayOfWeek(DateTime));
    Result = $mod.IsLeapYear(Year.get());
    return Result;
  };
  this.Date = function () {
    var Result = 0.0;
    Result = pas.System.Trunc($mod.Now());
    return Result;
  };
  this.Now = function () {
    var Result = 0.0;
    Result = $mod.JSDateToDateTime(new Date());
    return Result;
  };
  this.DayOfWeek = function (DateTime) {
    var Result = 0;
    Result = 1 + ((pas.System.Trunc(DateTime) - 1) % 7);
    if (Result <= 0) Result += 7;
    return Result;
  };
  this.IsLeapYear = function (Year) {
    var Result = false;
    Result = ((Year % 4) === 0) && (((Year % 100) !== 0) || ((Year % 400) === 0));
    return Result;
  };
  this.DateToStr = function (date) {
    var Result = "";
    Result = $mod.DateToStr$1(date,$mod.FormatSettings);
    return Result;
  };
  this.DateToStr$1 = function (date, aSettings) {
    var Result = "";
    Result = $mod.FormatDateTime$1("ddddd",date,aSettings);
    return Result;
  };
  this.StrToDate = function (S) {
    var Result = 0.0;
    Result = $mod.StrToDate$3(S,$mod.FormatSettings);
    return Result;
  };
  this.StrToDate$2 = function (S, useformat, separator) {
    var Result = 0.0;
    var MSg = "";
    Result = $impl.IntStrToDate({get: function () {
        return MSg;
      }, set: function (v) {
        MSg = v;
      }},S,useformat,separator);
    if (MSg !== "") throw $mod.EConvertError.$create("Create$1",[MSg]);
    return Result;
  };
  this.StrToDate$3 = function (S, aSettings) {
    var Result = 0.0;
    Result = $mod.StrToDate$2(S,aSettings.ShortDateFormat,aSettings.DateSeparator);
    return Result;
  };
  this.FormatDateTime = function (aFormatStr, DateTime) {
    var Result = "";
    Result = $mod.FormatDateTime$1(aFormatStr,DateTime,$mod.FormatSettings);
    return Result;
  };
  this.FormatDateTime$1 = function (aFormatStr, DateTime, aSettings) {
    var Result = "";
    function StoreString(AStr) {
      Result = Result + AStr;
    };
    function StoreInt(Value, Digits) {
      var S = "";
      S = $mod.IntToStr(Value);
      while (S.length < Digits) S = "0" + S;
      StoreString(S);
    };
    var Year = 0;
    var Month = 0;
    var Day = 0;
    var DayOfWeek = 0;
    var Hour = 0;
    var Minute = 0;
    var Second = 0;
    var MilliSecond = 0;
    function StoreFormat(FormatStr, Nesting, TimeFlag) {
      function StoreStr(APos, Len) {
        Result = Result + pas.System.Copy(aFormatStr,APos,Len);
      };
      var Token = "\x00";
      var lastformattoken = "\x00";
      var prevlasttoken = "\x00";
      var Count = 0;
      var Clock12 = false;
      var tmp = 0;
      var isInterval = false;
      var P = 0;
      var FormatCurrent = 0;
      var FormatEnd = 0;
      if (Nesting > 1) return;
      FormatCurrent = 1;
      FormatEnd = FormatStr.length;
      Clock12 = false;
      isInterval = false;
      P = 1;
      while (P <= FormatEnd) {
        Token = FormatStr.charAt(P - 1);
        var $tmp = Token;
        if (($tmp === "'") || ($tmp === '"')) {
          P += 1;
          while ((P < FormatEnd) && (FormatStr.charAt(P - 1) !== Token)) P += 1;
        } else if (($tmp === "A") || ($tmp === "a")) {
          if (($mod.CompareText(pas.System.Copy(FormatStr,P,3),"A/P") === 0) || ($mod.CompareText(pas.System.Copy(FormatStr,P,4),"AMPM") === 0) || ($mod.CompareText(pas.System.Copy(FormatStr,P,5),"AM/PM") === 0)) {
            Clock12 = true;
            break;
          };
        };
        P += 1;
      };
      Token = "ÿ";
      lastformattoken = " ";
      prevlasttoken = "H";
      while (FormatCurrent <= FormatEnd) {
        Token = $mod.UpperCase(FormatStr.charAt(FormatCurrent - 1)).charAt(0);
        Count = 1;
        P = FormatCurrent + 1;
        var $tmp1 = Token;
        if (($tmp1 === "'") || ($tmp1 === '"')) {
          while ((P < FormatEnd) && (FormatStr.charAt(P - 1) !== Token)) P += 1;
          P += 1;
          Count = P - FormatCurrent;
          StoreStr(FormatCurrent + 1,Count - 2);
        } else if ($tmp1 === "A") {
          if ($mod.CompareText(pas.System.Copy(FormatStr,FormatCurrent,4),"AMPM") === 0) {
            Count = 4;
            if (Hour < 12) {
              StoreString(aSettings.TimeAMString)}
             else StoreString(aSettings.TimePMString);
          } else if ($mod.CompareText(pas.System.Copy(FormatStr,FormatCurrent,5),"AM/PM") === 0) {
            Count = 5;
            if (Hour < 12) {
              StoreStr(FormatCurrent,2)}
             else StoreStr(FormatCurrent + 3,2);
          } else if ($mod.CompareText(pas.System.Copy(FormatStr,FormatCurrent,3),"A/P") === 0) {
            Count = 3;
            if (Hour < 12) {
              StoreStr(FormatCurrent,1)}
             else StoreStr(FormatCurrent + 2,1);
          } else throw $mod.EConvertError.$create("Create$1",["Illegal character in format string"]);
        } else if ($tmp1 === "/") {
          StoreString(aSettings.DateSeparator);
        } else if ($tmp1 === ":") {
          StoreString(aSettings.TimeSeparator)}
         else if (($tmp1 === " ") || ($tmp1 === "C") || ($tmp1 === "D") || ($tmp1 === "H") || ($tmp1 === "M") || ($tmp1 === "N") || ($tmp1 === "S") || ($tmp1 === "T") || ($tmp1 === "Y") || ($tmp1 === "Z") || ($tmp1 === "F")) {
          while ((P <= FormatEnd) && ($mod.UpperCase(FormatStr.charAt(P - 1)) === Token)) P += 1;
          Count = P - FormatCurrent;
          var $tmp2 = Token;
          if ($tmp2 === " ") {
            StoreStr(FormatCurrent,Count)}
           else if ($tmp2 === "Y") {
            if (Count > 2) {
              StoreInt(Year,4)}
             else StoreInt(Year % 100,2);
          } else if ($tmp2 === "M") {
            if (isInterval && ((prevlasttoken === "H") || TimeFlag)) {
              StoreInt(Minute + ((Hour + (pas.System.Trunc(Math.abs(DateTime)) * 24)) * 60),0)}
             else if ((lastformattoken === "H") || TimeFlag) {
              if (Count === 1) {
                StoreInt(Minute,0)}
               else StoreInt(Minute,2);
            } else {
              var $tmp3 = Count;
              if ($tmp3 === 1) {
                StoreInt(Month,0)}
               else if ($tmp3 === 2) {
                StoreInt(Month,2)}
               else if ($tmp3 === 3) {
                StoreString(aSettings.ShortMonthNames[Month - 1])}
               else {
                StoreString(aSettings.LongMonthNames[Month - 1]);
              };
            };
          } else if ($tmp2 === "D") {
            var $tmp4 = Count;
            if ($tmp4 === 1) {
              StoreInt(Day,0)}
             else if ($tmp4 === 2) {
              StoreInt(Day,2)}
             else if ($tmp4 === 3) {
              StoreString(aSettings.ShortDayNames[DayOfWeek - 1])}
             else if ($tmp4 === 4) {
              StoreString(aSettings.LongDayNames[DayOfWeek - 1])}
             else if ($tmp4 === 5) {
              StoreFormat(aSettings.ShortDateFormat,Nesting + 1,false)}
             else {
              StoreFormat(aSettings.LongDateFormat,Nesting + 1,false);
            };
          } else if ($tmp2 === "H") {
            if (isInterval) {
              StoreInt(Hour + (pas.System.Trunc(Math.abs(DateTime)) * 24),0)}
             else if (Clock12) {
              tmp = Hour % 12;
              if (tmp === 0) tmp = 12;
              if (Count === 1) {
                StoreInt(tmp,0)}
               else StoreInt(tmp,2);
            } else {
              if (Count === 1) {
                StoreInt(Hour,0)}
               else StoreInt(Hour,2);
            }}
           else if ($tmp2 === "N") {
            if (isInterval) {
              StoreInt(Minute + ((Hour + (pas.System.Trunc(Math.abs(DateTime)) * 24)) * 60),0)}
             else if (Count === 1) {
              StoreInt(Minute,0)}
             else StoreInt(Minute,2)}
           else if ($tmp2 === "S") {
            if (isInterval) {
              StoreInt(Second + ((Minute + ((Hour + (pas.System.Trunc(Math.abs(DateTime)) * 24)) * 60)) * 60),0)}
             else if (Count === 1) {
              StoreInt(Second,0)}
             else StoreInt(Second,2)}
           else if ($tmp2 === "Z") {
            if (Count === 1) {
              StoreInt(MilliSecond,0)}
             else StoreInt(MilliSecond,3)}
           else if ($tmp2 === "T") {
            if (Count === 1) {
              StoreFormat(aSettings.ShortTimeFormat,Nesting + 1,true)}
             else StoreFormat(aSettings.LongTimeFormat,Nesting + 1,true)}
           else if ($tmp2 === "C") {
            StoreFormat(aSettings.ShortDateFormat,Nesting + 1,false);
            if ((Hour !== 0) || (Minute !== 0) || (Second !== 0)) {
              StoreString(" ");
              StoreFormat(aSettings.LongTimeFormat,Nesting + 1,true);
            };
          } else if ($tmp2 === "F") {
            StoreFormat(aSettings.ShortDateFormat,Nesting + 1,false);
            StoreString(" ");
            StoreFormat(aSettings.LongTimeFormat,Nesting + 1,true);
          };
          prevlasttoken = lastformattoken;
          lastformattoken = Token;
        } else {
          StoreString(Token);
        };
        FormatCurrent += Count;
      };
    };
    $mod.DecodeDateFully(DateTime,{get: function () {
        return Year;
      }, set: function (v) {
        Year = v;
      }},{get: function () {
        return Month;
      }, set: function (v) {
        Month = v;
      }},{get: function () {
        return Day;
      }, set: function (v) {
        Day = v;
      }},{get: function () {
        return DayOfWeek;
      }, set: function (v) {
        DayOfWeek = v;
      }});
    $mod.DecodeTime(DateTime,{get: function () {
        return Hour;
      }, set: function (v) {
        Hour = v;
      }},{get: function () {
        return Minute;
      }, set: function (v) {
        Minute = v;
      }},{get: function () {
        return Second;
      }, set: function (v) {
        Second = v;
      }},{get: function () {
        return MilliSecond;
      }, set: function (v) {
        MilliSecond = v;
      }});
    if (aFormatStr !== "") {
      StoreFormat(aFormatStr,0,false)}
     else StoreFormat("C",0,false);
    return Result;
  };
  this.GetLocalTimeOffset = function () {
    var Result = 0;
    Result = (new Date()).getTimezoneOffset();
    return Result;
  };
  this.GetLocalTimeOffset$1 = function (DateTime, InputIsUTC, Offset) {
    var Result = false;
    Offset.set($mod.DateTimeToJSDate(DateTime,InputIsUTC).getTimezoneOffset());
    Result = true;
    return Result;
  };
  this.GetLocalTimeOffset$2 = function (DateTime, InputIsUTC) {
    var Result = 0;
    if (!$mod.GetLocalTimeOffset$1(DateTime,InputIsUTC,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) Result = $mod.GetLocalTimeOffset();
    return Result;
  };
  this.CurrencyFormat = 0;
  this.NegCurrFormat = 0;
  this.CurrencyDecimals = 0;
  this.CurrencyString = "";
  this.TStringSplitOptions = {"0": "None", None: 0, "1": "ExcludeEmpty", ExcludeEmpty: 1};
  rtl.createHelper(this,"TStringHelper",null,function () {
    this.GetLength = function () {
      var Result = 0;
      Result = this.get().length;
      return Result;
    };
    this.IndexOfAny$3 = function (AnyOf, StartIndex) {
      var Result = 0;
      Result = $mod.TStringHelper.IndexOfAny$5.call(this,AnyOf,StartIndex,$mod.TStringHelper.GetLength.call(this));
      return Result;
    };
    this.IndexOfAny$5 = function (AnyOf, StartIndex, ACount) {
      var Result = 0;
      var i = 0;
      var L = 0;
      i = StartIndex + 1;
      L = (i + ACount) - 1;
      if (L > $mod.TStringHelper.GetLength.call(this)) L = $mod.TStringHelper.GetLength.call(this);
      Result = -1;
      while ((Result === -1) && (i <= L)) {
        if ($impl.HaveChar(this.get().charAt(i - 1),AnyOf)) Result = i - 1;
        i += 1;
      };
      return Result;
    };
    this.IndexOfAnyUnquoted$1 = function (AnyOf, StartQuote, EndQuote, StartIndex) {
      var Result = 0;
      Result = $mod.TStringHelper.IndexOfAnyUnquoted$2.call(this,AnyOf,StartQuote,EndQuote,StartIndex,$mod.TStringHelper.GetLength.call(this));
      return Result;
    };
    this.IndexOfAnyUnquoted$2 = function (AnyOf, StartQuote, EndQuote, StartIndex, ACount) {
      var Result = 0;
      var I = 0;
      var L = 0;
      var Q = 0;
      Result = -1;
      L = (StartIndex + ACount) - 1;
      if (L > $mod.TStringHelper.GetLength.call(this)) L = $mod.TStringHelper.GetLength.call(this);
      I = StartIndex + 1;
      Q = 0;
      if (StartQuote === EndQuote) {
        while ((Result === -1) && (I <= L)) {
          if (this.get().charAt(I - 1) === StartQuote) Q = 1 - Q;
          if ((Q === 0) && $impl.HaveChar(this.get().charAt(I - 1),AnyOf)) Result = I - 1;
          I += 1;
        };
      } else {
        while ((Result === -1) && (I <= L)) {
          if (this.get().charAt(I - 1) === StartQuote) {
            Q += 1}
           else if ((this.get().charAt(I - 1) === EndQuote) && (Q > 0)) Q -= 1;
          if ((Q === 0) && $impl.HaveChar(this.get().charAt(I - 1),AnyOf)) Result = I - 1;
          I += 1;
        };
      };
      return Result;
    };
    this.Split = function (Separators) {
      var Result = [];
      Result = $mod.TStringHelper.Split$1.call(this,$mod.TStringHelper.ToCharArray$1.call({get: function () {
          return Separators;
        }, set: function (v) {
          rtl.raiseE("EPropReadOnly");
        }}));
      return Result;
    };
    this.Split$1 = function (Separators) {
      var Result = [];
      Result = $mod.TStringHelper.Split$21.call(this,Separators,"\x00","\x00",$mod.TStringHelper.GetLength.call(this) + 1,0);
      return Result;
    };
    var BlockSize = 10;
    this.Split$21 = function (Separators, AQuoteStart, AQuoteEnd, ACount, Options) {
      var $Self = this;
      var Result = [];
      var S = "";
      function NextSep(StartIndex) {
        var Result = 0;
        if (AQuoteStart !== "\x00") {
          Result = $mod.TStringHelper.IndexOfAnyUnquoted$1.call({get: function () {
              return S;
            }, set: function (v) {
              S = v;
            }},Separators,AQuoteStart,AQuoteEnd,StartIndex)}
         else Result = $mod.TStringHelper.IndexOfAny$3.call({get: function () {
            return S;
          }, set: function (v) {
            S = v;
          }},Separators,StartIndex);
        return Result;
      };
      function MaybeGrow(Curlen) {
        if (rtl.length(Result) <= Curlen) Result = rtl.arraySetLength(Result,"",rtl.length(Result) + 10);
      };
      var Sep = 0;
      var LastSep = 0;
      var Len = 0;
      var T = "";
      S = $Self.get();
      Result = rtl.arraySetLength(Result,"",10);
      Len = 0;
      LastSep = 0;
      Sep = NextSep(0);
      while ((Sep !== -1) && ((ACount === 0) || (Len < ACount))) {
        T = $mod.TStringHelper.Substring$1.call($Self,LastSep,Sep - LastSep);
        if ((T !== "") || !(1 === Options)) {
          MaybeGrow(Len);
          Result[Len] = T;
          Len += 1;
        };
        LastSep = Sep + 1;
        Sep = NextSep(LastSep);
      };
      if ((LastSep <= $mod.TStringHelper.GetLength.call($Self)) && ((ACount === 0) || (Len < ACount))) {
        T = $mod.TStringHelper.Substring.call($Self,LastSep);
        if ((T !== "") || !(1 === Options)) {
          MaybeGrow(Len);
          Result[Len] = T;
          Len += 1;
        };
      };
      Result = rtl.arraySetLength(Result,"",Len);
      return Result;
    };
    this.Substring = function (AStartIndex) {
      var Result = "";
      Result = $mod.TStringHelper.Substring$1.call(this,AStartIndex,$mod.TStringHelper.GetLength.call(this) - AStartIndex);
      return Result;
    };
    this.Substring$1 = function (AStartIndex, ALen) {
      var Result = "";
      Result = pas.System.Copy(this.get(),AStartIndex + 1,ALen);
      return Result;
    };
    this.ToCharArray$1 = function () {
      var Result = [];
      Result = $mod.TStringHelper.ToCharArray$2.call(this,0,$mod.TStringHelper.GetLength.call(this));
      return Result;
    };
    this.ToCharArray$2 = function (AStartIndex, ALen) {
      var Result = [];
      var I = 0;
      Result = rtl.arraySetLength(Result,"\x00",ALen);
      for (var $l = 0, $end = ALen - 1; $l <= $end; $l++) {
        I = $l;
        Result[I] = this.get().charAt((AStartIndex + I + 1) - 1);
      };
      return Result;
    };
  });
  $mod.$implcode = function () {
    $impl.DefaultShortMonthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    $impl.DefaultLongMonthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    $impl.DefaultShortDayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    $impl.DefaultLongDayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    $impl.feInvalidFormat = 1;
    $impl.feMissingArgument = 2;
    $impl.feInvalidArgIndex = 3;
    $impl.DoFormatError = function (ErrCode, fmt) {
      var $tmp = ErrCode;
      if ($tmp === 1) {
        throw $mod.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SInvalidFormat"),pas.System.VarRecs(18,fmt)])}
       else if ($tmp === 2) {
        throw $mod.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SArgumentMissing"),pas.System.VarRecs(18,fmt)])}
       else if ($tmp === 3) throw $mod.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SInvalidArgIndex"),pas.System.VarRecs(18,fmt)]);
    };
    $impl.maxdigits = 15;
    $impl.ReplaceDecimalSep = function (S, DS) {
      var Result = "";
      var P = 0;
      P = pas.System.Pos(".",S);
      if (P > 0) {
        Result = pas.System.Copy(S,1,P - 1) + DS + pas.System.Copy(S,P + 1,S.length - P)}
       else Result = S;
      return Result;
    };
    $impl.FormatGeneralFloat = function (Value, Precision, DS) {
      var Result = "";
      var P = 0;
      var PE = 0;
      var Q = 0;
      var Exponent = 0;
      if ((Precision === -1) || (Precision > 15)) Precision = 15;
      Result = rtl.floatToStr(Value,Precision + 7);
      Result = $mod.TrimLeft(Result);
      P = pas.System.Pos(".",Result);
      if (P === 0) return Result;
      PE = pas.System.Pos("E",Result);
      if (PE === 0) {
        Result = $impl.ReplaceDecimalSep(Result,DS);
        return Result;
      };
      Q = PE + 2;
      Exponent = 0;
      while (Q <= Result.length) {
        Exponent = ((Exponent * 10) + Result.charCodeAt(Q - 1)) - 48;
        Q += 1;
      };
      if (Result.charAt((PE + 1) - 1) === "-") Exponent = -Exponent;
      if (((P + Exponent) < PE) && (Exponent > -6)) {
        Result = rtl.strSetLength(Result,PE - 1);
        if (Exponent >= 0) {
          for (var $l = 0, $end = Exponent - 1; $l <= $end; $l++) {
            Q = $l;
            Result = rtl.setCharAt(Result,P - 1,Result.charAt((P + 1) - 1));
            P += 1;
          };
          Result = rtl.setCharAt(Result,P - 1,".");
          P = 1;
          if (Result.charAt(P - 1) === "-") P += 1;
          while ((Result.charAt(P - 1) === "0") && (P < Result.length) && (pas.System.Copy(Result,P + 1,DS.length) !== DS)) pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},P,1);
        } else {
          pas.System.Insert(pas.System.Copy("00000",1,-Exponent),{get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},P - 1);
          Result = rtl.setCharAt(Result,P - Exponent - 1,Result.charAt(P - Exponent - 1 - 1));
          Result = rtl.setCharAt(Result,P - 1,".");
          if (Exponent !== -1) Result = rtl.setCharAt(Result,P - Exponent - 1 - 1,"0");
        };
        Q = Result.length;
        while ((Q > 0) && (Result.charAt(Q - 1) === "0")) Q -= 1;
        if (Result.charAt(Q - 1) === ".") Q -= 1;
        if ((Q === 0) || ((Q === 1) && (Result.charAt(0) === "-"))) {
          Result = "0"}
         else Result = rtl.strSetLength(Result,Q);
      } else {
        while (Result.charAt(PE - 1 - 1) === "0") {
          pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},PE - 1,1);
          PE -= 1;
        };
        if (Result.charAt(PE - 1 - 1) === DS) {
          pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},PE - 1,1);
          PE -= 1;
        };
        if (Result.charAt((PE + 1) - 1) === "+") {
          pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},PE + 1,1)}
         else PE += 1;
        while (Result.charAt((PE + 1) - 1) === "0") pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},PE + 1,1);
      };
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    $impl.FormatExponentFloat = function (Value, Precision, Digits, DS) {
      var Result = "";
      var P = 0;
      DS = $mod.FormatSettings.DecimalSeparator;
      if ((Precision === -1) || (Precision > 15)) Precision = 15;
      Result = rtl.floatToStr(Value,Precision + 7);
      while (Result.charAt(0) === " ") pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},1,1);
      P = pas.System.Pos("E",Result);
      if (P === 0) {
        Result = $impl.ReplaceDecimalSep(Result,DS);
        return Result;
      };
      P += 2;
      if (Digits > 4) Digits = 4;
      Digits = (Result.length - P - Digits) + 1;
      if (Digits < 0) {
        pas.System.Insert(pas.System.Copy("0000",1,-Digits),{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P)}
       else while ((Digits > 0) && (Result.charAt(P - 1) === "0")) {
        pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P,1);
        if (P > Result.length) {
          pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},P - 2,2);
          break;
        };
        Digits -= 1;
      };
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    $impl.FormatFixedFloat = function (Value, Digits, DS) {
      var Result = "";
      if (Digits === -1) {
        Digits = 2}
       else if (Digits > 18) Digits = 18;
      Result = rtl.floatToStr(Value,0,Digits);
      if ((Result !== "") && (Result.charAt(0) === " ")) pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},1,1);
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    $impl.FormatNumberFloat = function (Value, Digits, DS, TS) {
      var Result = "";
      var P = 0;
      if (Digits === -1) {
        Digits = 2}
       else if (Digits > 15) Digits = 15;
      Result = rtl.floatToStr(Value,0,Digits);
      if ((Result !== "") && (Result.charAt(0) === " ")) pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},1,1);
      P = pas.System.Pos(".",Result);
      if (P <= 0) P = Result.length + 1;
      Result = $impl.ReplaceDecimalSep(Result,DS);
      P -= 3;
      if ((TS !== "") && (TS !== "\x00")) while (P > 1) {
        if (Result.charAt(P - 1 - 1) !== "-") pas.System.Insert(TS,{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P);
        P -= 3;
      };
      return Result;
    };
    $impl.RemoveLeadingNegativeSign = function (AValue, DS, aThousandSeparator) {
      var Result = false;
      var i = 0;
      var TS = "";
      var StartPos = 0;
      Result = false;
      StartPos = 2;
      TS = aThousandSeparator;
      for (var $l = StartPos, $end = AValue.get().length; $l <= $end; $l++) {
        i = $l;
        Result = (AValue.get().charCodeAt(i - 1) in rtl.createSet(48,DS.charCodeAt(),69,43)) || (AValue.get().charAt(i - 1) === TS);
        if (!Result) break;
      };
      if (Result && (AValue.get().charAt(0) === "-")) pas.System.Delete(AValue,1,1);
      return Result;
    };
    $impl.FormatNumberCurrency = function (Value, Digits, aSettings) {
      var Result = "";
      var Negative = false;
      var P = 0;
      var CS = "";
      var DS = "";
      var TS = "";
      DS = aSettings.DecimalSeparator;
      TS = aSettings.ThousandSeparator;
      CS = aSettings.CurrencyString;
      if (Digits === -1) {
        Digits = aSettings.CurrencyDecimals}
       else if (Digits > 18) Digits = 18;
      Result = rtl.floatToStr(Value / 10000,0,Digits);
      Negative = Result.charAt(0) === "-";
      if (Negative) pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},1,1);
      P = pas.System.Pos(".",Result);
      if (TS !== "") {
        if (P !== 0) {
          Result = $impl.ReplaceDecimalSep(Result,DS)}
         else P = Result.length + 1;
        P -= 3;
        while (P > 1) {
          pas.System.Insert(TS,{get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},P);
          P -= 3;
        };
      };
      if (Negative) $impl.RemoveLeadingNegativeSign({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},DS,TS);
      if (!Negative) {
        var $tmp = aSettings.CurrencyFormat;
        if ($tmp === 0) {
          Result = CS + Result}
         else if ($tmp === 1) {
          Result = Result + CS}
         else if ($tmp === 2) {
          Result = CS + " " + Result}
         else if ($tmp === 3) Result = Result + " " + CS;
      } else {
        var $tmp1 = aSettings.NegCurrFormat;
        if ($tmp1 === 0) {
          Result = "(" + CS + Result + ")"}
         else if ($tmp1 === 1) {
          Result = "-" + CS + Result}
         else if ($tmp1 === 2) {
          Result = CS + "-" + Result}
         else if ($tmp1 === 3) {
          Result = CS + Result + "-"}
         else if ($tmp1 === 4) {
          Result = "(" + Result + CS + ")"}
         else if ($tmp1 === 5) {
          Result = "-" + Result + CS}
         else if ($tmp1 === 6) {
          Result = Result + "-" + CS}
         else if ($tmp1 === 7) {
          Result = Result + CS + "-"}
         else if ($tmp1 === 8) {
          Result = "-" + Result + " " + CS}
         else if ($tmp1 === 9) {
          Result = "-" + CS + " " + Result}
         else if ($tmp1 === 10) {
          Result = Result + " " + CS + "-"}
         else if ($tmp1 === 11) {
          Result = CS + " " + Result + "-"}
         else if ($tmp1 === 12) {
          Result = CS + " " + "-" + Result}
         else if ($tmp1 === 13) {
          Result = Result + "-" + " " + CS}
         else if ($tmp1 === 14) {
          Result = "(" + CS + " " + Result + ")"}
         else if ($tmp1 === 15) Result = "(" + Result + " " + CS + ")";
      };
      return Result;
    };
    var WhiteSpace = " \b\t\n\f\r";
    var Digits = "0123456789";
    $impl.IntStrToDate = function (ErrorMsg, S, useformat, separator) {
      var Result = 0.0;
      function FixErrorMsg(errmarg) {
        ErrorMsg.set($mod.Format(rtl.getResStr(pas.RTLConsts,"SInvalidDateFormat"),pas.System.VarRecs(18,errmarg)));
      };
      var df = "";
      var d = 0;
      var m = 0;
      var y = 0;
      var ly = 0;
      var ld = 0;
      var lm = 0;
      var n = 0;
      var i = 0;
      var len = 0;
      var c = 0;
      var dp = 0;
      var mp = 0;
      var yp = 0;
      var which = 0;
      var s1 = "";
      var values = [];
      var YearMoreThenTwoDigits = false;
      values = rtl.arraySetLength(values,0,4);
      Result = 0;
      len = S.length;
      ErrorMsg.set("");
      while ((len > 0) && (pas.System.Pos(S.charAt(len - 1),WhiteSpace) > 0)) len -= 1;
      if (len === 0) {
        FixErrorMsg(S);
        return Result;
      };
      YearMoreThenTwoDigits = false;
      if (separator === "\x00") if ($mod.FormatSettings.DateSeparator !== "\x00") {
        separator = $mod.FormatSettings.DateSeparator}
       else separator = "-";
      df = $mod.UpperCase(useformat);
      yp = 0;
      mp = 0;
      dp = 0;
      which = 0;
      i = 0;
      while ((i < df.length) && (which < 3)) {
        i += 1;
        var $tmp = df.charAt(i - 1);
        if ($tmp === "Y") {
          if (yp === 0) {
            which += 1;
            yp = which;
          }}
         else if ($tmp === "M") {
          if (mp === 0) {
            which += 1;
            mp = which;
          }}
         else if ($tmp === "D") if (dp === 0) {
          which += 1;
          dp = which;
        };
      };
      for (i = 1; i <= 3; i++) values[i] = 0;
      s1 = "";
      n = 0;
      for (var $l = 1, $end = len; $l <= $end; $l++) {
        i = $l;
        if (pas.System.Pos(S.charAt(i - 1),Digits) > 0) s1 = s1 + S.charAt(i - 1);
        if ((separator !== " ") && (S.charAt(i - 1) === " ")) continue;
        if ((S.charAt(i - 1) === separator) || ((i === len) && (pas.System.Pos(S.charAt(i - 1),Digits) > 0))) {
          n += 1;
          if (n > 3) {
            FixErrorMsg(S);
            return Result;
          };
          if ((n === yp) && (s1.length > 2)) YearMoreThenTwoDigits = true;
          pas.System.val$6(s1,{a: n, p: values, get: function () {
              return this.p[this.a];
            }, set: function (v) {
              this.p[this.a] = v;
            }},{get: function () {
              return c;
            }, set: function (v) {
              c = v;
            }});
          if (c !== 0) {
            FixErrorMsg(S);
            return Result;
          };
          s1 = "";
        } else if (pas.System.Pos(S.charAt(i - 1),Digits) === 0) {
          FixErrorMsg(S);
          return Result;
        };
      };
      if ((which < 3) && (n > which)) {
        FixErrorMsg(S);
        return Result;
      };
      $mod.DecodeDate($mod.Date(),{get: function () {
          return ly;
        }, set: function (v) {
          ly = v;
        }},{get: function () {
          return lm;
        }, set: function (v) {
          lm = v;
        }},{get: function () {
          return ld;
        }, set: function (v) {
          ld = v;
        }});
      if (n === 3) {
        y = values[yp];
        m = values[mp];
        d = values[dp];
      } else {
        y = ly;
        if (n < 2) {
          d = values[1];
          m = lm;
        } else if (dp < mp) {
          d = values[1];
          m = values[2];
        } else {
          d = values[2];
          m = values[1];
        };
      };
      if ((y >= 0) && (y < 100) && !YearMoreThenTwoDigits) {
        ly = ly - $mod.TwoDigitYearCenturyWindow;
        y += rtl.trunc(ly / 100) * 100;
        if (($mod.TwoDigitYearCenturyWindow > 0) && (y < ly)) y += 100;
      };
      if (!$mod.TryEncodeDate(y,m,d,{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }})) ErrorMsg.set(rtl.getResStr(pas.RTLConsts,"SErrInvalidDate"));
      return Result;
    };
    $impl.IntTryStrToInt = function (S, res, aSep) {
      var Result = false;
      var Radix = 10;
      var N = "";
      var J = undefined;
      N = S;
      if ((pas.System.Pos(aSep,N) !== 0) || (pas.System.Pos(".",N) !== 0)) return false;
      var $tmp = pas.System.Copy(N,1,1);
      if ($tmp === "$") {
        Radix = 16}
       else if ($tmp === "&") {
        Radix = 8}
       else if ($tmp === "%") Radix = 2;
      if ((Radix !== 16) && (pas.System.Pos("e",$mod.LowerCase(N)) !== 0)) return false;
      if (Radix !== 10) pas.System.Delete({get: function () {
          return N;
        }, set: function (v) {
          N = v;
        }},1,1);
      J = parseInt(N,Radix);
      Result = !isNaN(J);
      if (Result) res.set(rtl.trunc(J));
      return Result;
    };
    $impl.InitGlobalFormatSettings = function () {
      $mod.FormatSettings.$assign($mod.TFormatSettings.Create());
      $mod.TimeSeparator = $mod.FormatSettings.TimeSeparator;
      $mod.DateSeparator = $mod.FormatSettings.DateSeparator;
      $mod.ShortDateFormat = $mod.FormatSettings.ShortDateFormat;
      $mod.LongDateFormat = $mod.FormatSettings.LongDateFormat;
      $mod.ShortTimeFormat = $mod.FormatSettings.ShortTimeFormat;
      $mod.LongTimeFormat = $mod.FormatSettings.LongTimeFormat;
      $mod.DecimalSeparator = $mod.FormatSettings.DecimalSeparator;
      $mod.ThousandSeparator = $mod.FormatSettings.ThousandSeparator;
      $mod.TimeAMString = $mod.FormatSettings.TimeAMString;
      $mod.TimePMString = $mod.FormatSettings.TimePMString;
      $mod.CurrencyFormat = $mod.FormatSettings.CurrencyFormat;
      $mod.NegCurrFormat = $mod.FormatSettings.NegCurrFormat;
      $mod.CurrencyDecimals = $mod.FormatSettings.CurrencyDecimals;
      $mod.CurrencyString = $mod.FormatSettings.CurrencyString;
    };
    $impl.HaveChar = function (AChar, AList) {
      var Result = false;
      var I = 0;
      I = 0;
      Result = false;
      while (!Result && (I < rtl.length(AList))) {
        Result = AList[I] === AChar;
        I += 1;
      };
      return Result;
    };
  };
  $mod.$init = function () {
    (function () {
      $impl.InitGlobalFormatSettings();
    })();
    $mod.ShortMonthNames = $impl.DefaultShortMonthNames.slice(0);
    $mod.LongMonthNames = $impl.DefaultLongMonthNames.slice(0);
    $mod.ShortDayNames = $impl.DefaultShortDayNames.slice(0);
    $mod.LongDayNames = $impl.DefaultLongDayNames.slice(0);
  };
},[]);
rtl.module("Classes",["System","RTLConsts","Types","SysUtils","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"EListError",pas.SysUtils.Exception,function () {
  });
  rtl.createClass(this,"EComponentError",pas.SysUtils.Exception,function () {
  });
  rtl.createClass(this,"TFPList",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = [];
      this.FCount = 0;
      this.FCapacity = 0;
    };
    this.$final = function () {
      this.FList = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Get = function (Index) {
      var Result = undefined;
      if ((Index < 0) || (Index >= this.FCount)) this.RaiseIndexError(Index);
      Result = this.FList[Index];
      return Result;
    };
    this.SetCapacity = function (NewCapacity) {
      if (NewCapacity < this.FCount) this.$class.Error(rtl.getResStr(pas.RTLConsts,"SListCapacityError"),"" + NewCapacity);
      if (NewCapacity === this.FCapacity) return;
      this.FList = rtl.arraySetLength(this.FList,undefined,NewCapacity);
      this.FCapacity = NewCapacity;
    };
    this.SetCount = function (NewCount) {
      if (NewCount < 0) this.$class.Error(rtl.getResStr(pas.RTLConsts,"SListCountError"),"" + NewCount);
      if (NewCount > this.FCount) {
        if (NewCount > this.FCapacity) this.SetCapacity(NewCount);
      };
      this.FCount = NewCount;
    };
    this.RaiseIndexError = function (Index) {
      this.$class.Error(rtl.getResStr(pas.RTLConsts,"SListIndexError"),"" + Index);
    };
    this.Destroy = function () {
      this.Clear();
      pas.System.TObject.Destroy.call(this);
    };
    this.Add = function (Item) {
      var Result = 0;
      if (this.FCount === this.FCapacity) this.Expand();
      this.FList[this.FCount] = Item;
      Result = this.FCount;
      this.FCount += 1;
      return Result;
    };
    this.Clear = function () {
      if (rtl.length(this.FList) > 0) {
        this.SetCount(0);
        this.SetCapacity(0);
      };
    };
    this.Delete = function (Index) {
      if ((Index < 0) || (Index >= this.FCount)) this.$class.Error(rtl.getResStr(pas.RTLConsts,"SListIndexError"),"" + Index);
      this.FCount = this.FCount - 1;
      this.FList.splice(Index,1);
      this.FCapacity -= 1;
    };
    this.Error = function (Msg, Data) {
      throw $mod.EListError.$create("CreateFmt",[Msg,pas.System.VarRecs(18,Data)]);
    };
    this.Expand = function () {
      var Result = null;
      var IncSize = 0;
      if (this.FCount < this.FCapacity) return this;
      IncSize = 4;
      if (this.FCapacity > 3) IncSize = IncSize + 4;
      if (this.FCapacity > 8) IncSize = IncSize + 8;
      if (this.FCapacity > 127) IncSize += this.FCapacity >>> 2;
      this.SetCapacity(this.FCapacity + IncSize);
      Result = this;
      return Result;
    };
    this.IndexOf = function (Item) {
      var Result = 0;
      var C = 0;
      Result = 0;
      C = this.FCount;
      while ((Result < C) && (this.FList[Result] != Item)) Result += 1;
      if (Result >= C) Result = -1;
      return Result;
    };
    this.Last = function () {
      var Result = undefined;
      if (this.FCount === 0) {
        Result = null}
       else Result = this.Get(this.FCount - 1);
      return Result;
    };
    this.Remove = function (Item) {
      var Result = 0;
      Result = this.IndexOf(Item);
      if (Result !== -1) this.Delete(Result);
      return Result;
    };
  });
  rtl.createClass(this,"TPersistent",pas.System.TObject,function () {
  });
  this.TOperation = {"0": "opInsert", opInsert: 0, "1": "opRemove", opRemove: 1};
  this.TComponentStateItem = {"0": "csLoading", csLoading: 0, "1": "csReading", csReading: 1, "2": "csWriting", csWriting: 2, "3": "csDestroying", csDestroying: 3, "4": "csDesigning", csDesigning: 4, "5": "csAncestor", csAncestor: 5, "6": "csUpdating", csUpdating: 6, "7": "csFixups", csFixups: 7, "8": "csFreeNotification", csFreeNotification: 8, "9": "csInline", csInline: 9, "10": "csDesignInstance", csDesignInstance: 10};
  this.TComponentStyleItem = {"0": "csInheritable", csInheritable: 0, "1": "csCheckPropAvail", csCheckPropAvail: 1, "2": "csSubComponent", csSubComponent: 2, "3": "csTransient", csTransient: 3};
  rtl.createClass(this,"TComponent",this.TPersistent,function () {
    this.$init = function () {
      $mod.TPersistent.$init.call(this);
      this.FOwner = null;
      this.FName = "";
      this.FTag = 0;
      this.FComponents = null;
      this.FFreeNotifies = null;
      this.FComponentState = {};
      this.FComponentStyle = {};
    };
    this.$final = function () {
      this.FOwner = undefined;
      this.FComponents = undefined;
      this.FFreeNotifies = undefined;
      this.FComponentState = undefined;
      this.FComponentStyle = undefined;
      $mod.TPersistent.$final.call(this);
    };
    this.Insert = function (AComponent) {
      if (!(this.FComponents != null)) this.FComponents = $mod.TFPList.$create("Create");
      this.FComponents.Add(AComponent);
      AComponent.FOwner = this;
    };
    this.Remove = function (AComponent) {
      AComponent.FOwner = null;
      if (this.FComponents != null) {
        this.FComponents.Remove(AComponent);
        if (this.FComponents.FCount === 0) {
          this.FComponents.$destroy("Destroy");
          this.FComponents = null;
        };
      };
    };
    this.RemoveNotification = function (AComponent) {
      if (this.FFreeNotifies !== null) {
        this.FFreeNotifies.Remove(AComponent);
        if (this.FFreeNotifies.FCount === 0) {
          this.FFreeNotifies.$destroy("Destroy");
          this.FFreeNotifies = null;
          this.FComponentState = rtl.excludeSet(this.FComponentState,8);
        };
      };
    };
    this.SetReference = function (Enable) {
      var aField = null;
      var aValue = null;
      var aOwner = null;
      if (this.FName === "") return;
      if (this.FOwner != null) {
        aOwner = this.FOwner;
        aField = this.FOwner.$class.FieldAddress(this.FName);
        if (aField != null) {
          if (Enable) {
            aValue = this}
           else aValue = null;
          aOwner["" + aField["name"]] = aValue;
        };
      };
    };
    this.ChangeName = function (NewName) {
      this.FName = NewName;
    };
    this.Notification = function (AComponent, Operation) {
      var C = 0;
      if (Operation === 1) this.RemoveFreeNotification(AComponent);
      if (!(this.FComponents != null)) return;
      C = this.FComponents.FCount - 1;
      while (C >= 0) {
        rtl.getObject(this.FComponents.Get(C)).Notification(AComponent,Operation);
        C -= 1;
        if (C >= this.FComponents.FCount) C = this.FComponents.FCount - 1;
      };
    };
    this.SetDesigning = function (Value, SetChildren) {
      var Runner = 0;
      if (Value) {
        this.FComponentState = rtl.includeSet(this.FComponentState,4)}
       else this.FComponentState = rtl.excludeSet(this.FComponentState,4);
      if ((this.FComponents != null) && SetChildren) for (var $l = 0, $end = this.FComponents.FCount - 1; $l <= $end; $l++) {
        Runner = $l;
        rtl.getObject(this.FComponents.Get(Runner)).SetDesigning(Value,true);
      };
    };
    this.SetName = function (NewName) {
      if (this.FName === NewName) return;
      if ((NewName !== "") && !pas.SysUtils.IsValidIdent(NewName,false,false)) throw $mod.EComponentError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SInvalidName"),pas.System.VarRecs(18,NewName)]);
      if (this.FOwner != null) {
        this.FOwner.ValidateRename(this,this.FName,NewName)}
       else this.ValidateRename(null,this.FName,NewName);
      this.SetReference(false);
      this.ChangeName(NewName);
      this.SetReference(true);
    };
    this.ValidateRename = function (AComponent, CurName, NewName) {
      if ((AComponent !== null) && (pas.SysUtils.CompareText(CurName,NewName) !== 0) && (AComponent.FOwner === this) && (this.FindComponent(NewName) !== null)) throw $mod.EComponentError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SDuplicateName"),pas.System.VarRecs(18,NewName)]);
      if ((4 in this.FComponentState) && (this.FOwner !== null)) this.FOwner.ValidateRename(AComponent,CurName,NewName);
    };
    this.ValidateContainer = function (AComponent) {
      AComponent.ValidateInsert(this);
    };
    this.ValidateInsert = function (AComponent) {
      if (AComponent === null) ;
    };
    this.Create$1 = function (AOwner) {
      this.FComponentStyle = rtl.createSet(0);
      if (AOwner != null) AOwner.InsertComponent(this);
      return this;
    };
    this.Destroy = function () {
      var I = 0;
      var C = null;
      this.Destroying();
      if (this.FFreeNotifies != null) {
        I = this.FFreeNotifies.FCount - 1;
        while (I >= 0) {
          C = rtl.getObject(this.FFreeNotifies.Get(I));
          this.FFreeNotifies.Delete(I);
          C.Notification(this,1);
          if (this.FFreeNotifies === null) {
            I = 0}
           else if (I > this.FFreeNotifies.FCount) I = this.FFreeNotifies.FCount;
          I -= 1;
        };
        pas.SysUtils.FreeAndNil({p: this, get: function () {
            return this.p.FFreeNotifies;
          }, set: function (v) {
            this.p.FFreeNotifies = v;
          }});
      };
      this.DestroyComponents();
      if (this.FOwner !== null) this.FOwner.RemoveComponent(this);
      pas.System.TObject.Destroy.call(this);
    };
    this.BeforeDestruction = function () {
      if (!(3 in this.FComponentState)) this.Destroying();
    };
    this.DestroyComponents = function () {
      var acomponent = null;
      while (this.FComponents != null) {
        acomponent = rtl.getObject(this.FComponents.Last());
        this.Remove(acomponent);
        acomponent.$destroy("Destroy");
      };
    };
    this.Destroying = function () {
      var Runner = 0;
      if (3 in this.FComponentState) return;
      this.FComponentState = rtl.includeSet(this.FComponentState,3);
      if (this.FComponents != null) for (var $l = 0, $end = this.FComponents.FCount - 1; $l <= $end; $l++) {
        Runner = $l;
        rtl.getObject(this.FComponents.Get(Runner)).Destroying();
      };
    };
    this.FindComponent = function (AName) {
      var Result = null;
      var I = 0;
      Result = null;
      if ((AName === "") || !(this.FComponents != null)) return Result;
      for (var $l = 0, $end = this.FComponents.FCount - 1; $l <= $end; $l++) {
        I = $l;
        if (pas.SysUtils.CompareText(rtl.getObject(this.FComponents.Get(I)).FName,AName) === 0) {
          Result = rtl.getObject(this.FComponents.Get(I));
          return Result;
        };
      };
      return Result;
    };
    this.RemoveFreeNotification = function (AComponent) {
      this.RemoveNotification(AComponent);
      AComponent.RemoveNotification(this);
    };
    this.InsertComponent = function (AComponent) {
      AComponent.ValidateContainer(this);
      this.ValidateRename(AComponent,"",AComponent.FName);
      if (AComponent.FOwner !== null) AComponent.FOwner.RemoveComponent(AComponent);
      this.Insert(AComponent);
      if (4 in this.FComponentState) AComponent.SetDesigning(true,true);
      this.Notification(AComponent,0);
    };
    this.RemoveComponent = function (AComponent) {
      this.Notification(AComponent,1);
      this.Remove(AComponent);
      AComponent.SetDesigning(false,true);
      this.ValidateRename(AComponent,AComponent.FName,"");
    };
    var $r = this.$rtti;
    $r.addMethod("Create$1",2,[["AOwner",$r]]);
    $r.addProperty("Name",6,rtl.string,"FName","SetName");
    $r.addProperty("Tag",0,rtl.nativeint,"FTag","FTag",{Default: 0});
  });
  this.RegisterFindGlobalComponentProc = function (AFindGlobalComponent) {
    if (!($impl.FindGlobalComponentList != null)) $impl.FindGlobalComponentList = $mod.TFPList.$create("Create");
    if ($impl.FindGlobalComponentList.IndexOf(AFindGlobalComponent) < 0) $impl.FindGlobalComponentList.Add(AFindGlobalComponent);
  };
  $mod.$implcode = function () {
    $impl.ClassList = null;
    $impl.FindGlobalComponentList = null;
  };
  $mod.$init = function () {
    $impl.ClassList = new Object();
  };
},[]);
rtl.module("weborworker",["System","JS","Types"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("Web",["System","Types","JS","weborworker"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("CustApp",["System","Classes","SysUtils","Types","JS"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TCustomApplication",pas.Classes.TComponent,function () {
    this.$init = function () {
      pas.Classes.TComponent.$init.call(this);
      this.FExceptObjectJS = undefined;
      this.FTerminated = false;
      this.FOptionChar = "\x00";
      this.FCaseSensitiveOptions = false;
      this.FStopOnException = false;
      this.FExceptionExitCode = 0;
      this.FExceptObject = null;
    };
    this.$final = function () {
      this.FExceptObject = undefined;
      pas.Classes.TComponent.$final.call(this);
    };
    this.Create$1 = function (AOwner) {
      pas.Classes.TComponent.Create$1.call(this,AOwner);
      this.FOptionChar = "-";
      this.FCaseSensitiveOptions = true;
      this.FStopOnException = false;
      return this;
    };
    this.HandleException = function (Sender) {
      var E = null;
      var Tmp = null;
      Tmp = null;
      E = this.FExceptObject;
      if ((E === null) && pas.System.Assigned(this.FExceptObjectJS)) {
        if (rtl.isExt(this.FExceptObjectJS,Error,1)) {
          Tmp = pas.SysUtils.EExternalException.$create("Create$1",[this.FExceptObjectJS.message])}
         else if (rtl.isExt(this.FExceptObjectJS,Object,1) && this.FExceptObjectJS.hasOwnProperty("message")) {
          Tmp = pas.SysUtils.EExternalException.$create("Create$1",["" + this.FExceptObjectJS["message"]])}
         else Tmp = pas.SysUtils.EExternalException.$create("Create$1",[JSON.stringify(this.FExceptObjectJS)]);
        E = Tmp;
      };
      try {
        this.ShowException(E);
        if (this.FStopOnException) this.Terminate$1(this.FExceptionExitCode);
      } finally {
        Tmp = rtl.freeLoc(Tmp);
      };
      if (Sender === null) ;
    };
    this.Initialize = function () {
      this.FTerminated = false;
    };
    this.Run = function () {
      do {
        this.FExceptObject = null;
        this.FExceptObjectJS = null;
        try {
          this.DoRun();
        } catch ($e) {
          if (pas.SysUtils.Exception.isPrototypeOf($e)) {
            var E = $e;
            this.FExceptObject = E;
            this.FExceptObjectJS = E;
            this.HandleException(this);
          } else {
            this.FExceptObject = null;
            this.FExceptObjectJS = $e;
            this.HandleException(this);
          }
        };
        break;
      } while (!this.FTerminated);
    };
    this.Terminate$1 = function (AExitCode) {
      this.FTerminated = true;
      rtl.exitcode = AExitCode;
    };
    var $r = this.$rtti;
    $r.addMethod("Create$1",2,[["AOwner",pas.Classes.$rtti["TComponent"]]]);
  });
});
rtl.module("BrowserApp",["System","Classes","SysUtils","Types","JS","Web","CustApp"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"TBrowserApplication",pas.CustApp.TCustomApplication,function () {
    this.$init = function () {
      pas.CustApp.TCustomApplication.$init.call(this);
      this.FShowExceptions = false;
    };
    this.DoRun = function () {
    };
    this.Create$1 = function (aOwner) {
      pas.CustApp.TCustomApplication.Create$1.call(this,aOwner);
      this.FShowExceptions = true;
      if ($impl.AppInstance === null) {
        $impl.AppInstance = this;
        pas.Classes.RegisterFindGlobalComponentProc($impl.DoFindGlobalComponent);
      };
      return this;
    };
    this.Destroy = function () {
      if ($impl.AppInstance === this) $impl.AppInstance = null;
      pas.Classes.TComponent.Destroy.call(this);
    };
    this.ShowException = function (E) {
      var S = "";
      if (E !== null) {
        S = E.$classname + ": " + E.fMessage}
       else if (this.FExceptObjectJS) S = this.FExceptObjectJS.toString();
      S = "Unhandled exception caught: " + S;
      if (this.FShowExceptions) window.alert(S);
      pas.System.Writeln(S);
    };
    this.HandleException = function (Sender) {
      if (pas.SysUtils.Exception.isPrototypeOf(this.FExceptObject)) this.ShowException(this.FExceptObject);
      pas.CustApp.TCustomApplication.HandleException.call(this,Sender);
    };
    var $r = this.$rtti;
    $r.addMethod("Create$1",2,[["aOwner",pas.Classes.$rtti["TComponent"]]]);
  });
  this.ReloadEnvironmentStrings = function () {
    var I = 0;
    var S = "";
    var N = "";
    var A = [];
    var P = [];
    if ($impl.EnvNames != null) pas.SysUtils.FreeAndNil({p: $impl, get: function () {
        return this.p.EnvNames;
      }, set: function (v) {
        this.p.EnvNames = v;
      }});
    $impl.EnvNames = new Object();
    S = window.location.search;
    S = pas.System.Copy(S,2,S.length - 1);
    A = S.split("&");
    for (var $l = 0, $end = rtl.length(A) - 1; $l <= $end; $l++) {
      I = $l;
      P = A[I].split("=");
      N = pas.SysUtils.LowerCase(decodeURIComponent(P[0]));
      if (rtl.length(P) === 2) {
        $impl.EnvNames[N] = decodeURIComponent(P[1])}
       else if (rtl.length(P) === 1) $impl.EnvNames[N] = "";
    };
  };
  $mod.$implcode = function () {
    $impl.EnvNames = null;
    $impl.Params = [];
    $impl.AppInstance = null;
    $impl.ReloadParamStrings = function () {
      var ParsLine = "";
      var Pars = [];
      var I = 0;
      ParsLine = pas.System.Copy$1(window.location.hash,2);
      if (ParsLine !== "") {
        Pars = pas.SysUtils.TStringHelper.Split$1.call({get: function () {
            return ParsLine;
          }, set: function (v) {
            ParsLine = v;
          }},["/"])}
       else Pars = rtl.arraySetLength(Pars,"",0);
      $impl.Params = rtl.arraySetLength($impl.Params,"",1 + rtl.length(Pars));
      $impl.Params[0] = window.location.pathname;
      for (var $l = 0, $end = rtl.length(Pars) - 1; $l <= $end; $l++) {
        I = $l;
        $impl.Params[1 + I] = Pars[I];
      };
    };
    $impl.GetParamCount = function () {
      var Result = 0;
      Result = rtl.length($impl.Params) - 1;
      return Result;
    };
    $impl.GetParamStr = function (Index) {
      var Result = "";
      if ((Index >= 0) && (Index < rtl.length($impl.Params))) Result = $impl.Params[Index];
      return Result;
    };
    $impl.MyGetEnvironmentVariable = function (EnvVar) {
      var Result = "";
      var aName = "";
      aName = pas.SysUtils.LowerCase(EnvVar);
      if ($impl.EnvNames.hasOwnProperty(aName)) {
        Result = "" + $impl.EnvNames[aName]}
       else Result = "";
      return Result;
    };
    $impl.MyGetEnvironmentVariableCount = function () {
      var Result = 0;
      Result = rtl.length(Object.getOwnPropertyNames($impl.EnvNames));
      return Result;
    };
    $impl.MyGetEnvironmentString = function (Index) {
      var Result = "";
      Result = "" + $impl.EnvNames[Object.getOwnPropertyNames($impl.EnvNames)[Index]];
      return Result;
    };
    $impl.DoFindGlobalComponent = function (aName) {
      var Result = null;
      if ($impl.AppInstance != null) {
        Result = $impl.AppInstance.FindComponent(aName)}
       else Result = null;
      return Result;
    };
  };
  $mod.$init = function () {
    pas.System.IsConsole = true;
    pas.System.OnParamCount = $impl.GetParamCount;
    pas.System.OnParamStr = $impl.GetParamStr;
    $mod.ReloadEnvironmentStrings();
    $impl.ReloadParamStrings();
    pas.SysUtils.OnGetEnvironmentVariable = $impl.MyGetEnvironmentVariable;
    pas.SysUtils.OnGetEnvironmentVariableCount = $impl.MyGetEnvironmentVariableCount;
    pas.SysUtils.OnGetEnvironmentString = $impl.MyGetEnvironmentString;
  };
},[]);
rtl.module("login",["System","JS","Web","Classes"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TLoginView",pas.Classes.TComponent,function () {
    this.$init = function () {
      pas.Classes.TComponent.$init.call(this);
      this.login_dialog = null;
      this.login_form = null;
      this.login_user = null;
      this.login_password = null;
      this.login_btnsubmit = null;
      this.login_msg = null;
    };
    this.$final = function () {
      this.login_dialog = undefined;
      this.login_form = undefined;
      this.login_user = undefined;
      this.login_password = undefined;
      this.login_btnsubmit = undefined;
      this.login_msg = undefined;
      pas.Classes.TComponent.$final.call(this);
    };
    this.OnSubmit = function (Event) {
      var Result = false;
      pas.main.MainForm.Login(this.login_user.value,this.login_password.value);
      return Result;
    };
    this.Create$1 = function (aOwner) {
      pas.Classes.TComponent.Create$1.apply(this,arguments);
      this.BindElements();
      return this;
    };
    this.BindElements = function () {
      this.login_dialog = document.getElementById("login-dialog");
      this.login_form = document.getElementById("login-form");
      this.login_user = document.getElementById("login-user");
      this.login_password = document.getElementById("login-password");
      this.login_btnsubmit = document.getElementById("login-btnsubmit");
      this.login_msg = document.getElementById("login-msg");
      this.login_form.onsubmit = rtl.createSafeCallback(this,"OnSubmit");
    };
    this.SmallMessage = function (aMsg) {
      this.login_msg.innerText = aMsg;
    };
    this.Show = function () {
      this.login_dialog.setAttribute("Open","");
    };
    this.Hide = function () {
      this.login_dialog.removeAttribute("Open");
    };
    var $r = this.$rtti;
    $r.addMethod("Create$1",2,[["aOwner",pas.Classes.$rtti["TComponent"]]]);
  });
},["main"]);
rtl.module("Math",["System"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.SameValue = function (A, B, Epsilon) {
    var Result = false;
    if (Epsilon === 0.0) Epsilon = Math.max(Math.min(Math.abs(A),Math.abs(B)) * 1E-12,1E-12);
    if (A > B) {
      Result = (A - B) <= Epsilon}
     else Result = (B - A) <= Epsilon;
    return Result;
  };
  $mod.$implcode = function () {
    $impl.DZeroResolution = 1E-12;
  };
},[]);
rtl.module("DateUtils",["System","SysUtils","Math"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.OneSecond = 1 / 86400;
  this.IncMinute = function (AValue, ANumberOfMinutes) {
    var Result = 0.0;
    if (AValue >= 0) {
      Result = AValue + (ANumberOfMinutes / 1440)}
     else Result = $impl.IncNegativeTime(AValue,ANumberOfMinutes / 1440);
    $impl.MaybeSkipTimeWarp(AValue,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }});
    return Result;
  };
  var FmtOffset = "%.02d:%.02d";
  var Sign = ["+","-"];
  this.DateToISO8601 = function (ADate, AInputIsUTC) {
    var Result = "";
    var Offset = 0;
    Result = pas.SysUtils.FormatDateTime($impl.FmtUTC,ADate);
    Offset = pas.SysUtils.GetLocalTimeOffset$2(ADate,AInputIsUTC);
    if (AInputIsUTC || (Offset === 0)) {
      Result = Result + "Z"}
     else {
      Result = Result + Sign[+(Offset > 0)];
      Offset = Math.abs(Offset);
      Result = Result + pas.SysUtils.Format(FmtOffset,pas.System.VarRecs(0,rtl.trunc(Offset / 60),0,Offset % 60));
    };
    return Result;
  };
  this.ISO8601ToDate = function (DateString, ReturnUTC) {
    var Result = 0.0;
    if (!$mod.TryISO8601ToDate(DateString,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},ReturnUTC)) throw pas.SysUtils.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SErrInvalidTimeStamp"),pas.System.VarRecs(18,DateString)]);
    return Result;
  };
  this.TryISO8601ToDate = function (DateString, ADateTime, ReturnUTC) {
    var Result = false;
    var S = "";
    var TZ = "";
    var L = 0;
    var Offset = 0;
    var TZOffset = 0;
    S = DateString;
    L = S.length;
    if (L === 0) return false;
    if (S.charAt(L - 1) === "Z") {
      TZ = "Z";
      S = pas.System.Copy(S,1,L - 1);
    } else if (((L > 11) && ((S.charCodeAt(10) in rtl.createSet(84,32)) || (S.charCodeAt(8) in rtl.createSet(84,32)))) || (S.charAt(0) === "T")) {
      if (S.charCodeAt(L - 2 - 1) in rtl.createSet(43,45)) {
        TZ = pas.System.Copy(S,L - 2,3);
        S = pas.System.Copy(S,1,L - 3);
      } else if (S.charCodeAt(L - 4 - 1) in rtl.createSet(43,45)) {
        TZ = pas.System.Copy(S,L - 4,5);
        S = pas.System.Copy(S,1,L - 5);
      } else if ((S.charCodeAt(L - 5 - 1) in rtl.createSet(43,45)) && ((L > 13) || (S.charAt(0) === "T"))) {
        TZ = pas.System.Copy(S,L - 5,6);
        S = pas.System.Copy(S,1,L - 6);
      };
    };
    Result = $impl.TryISOStrToDateTime(S,ADateTime) && $impl.TryISOTZStrToTZOffset(TZ,{get: function () {
        return TZOffset;
      }, set: function (v) {
        TZOffset = v;
      }});
    if (!Result) return Result;
    ADateTime.set($mod.IncMinute(ADateTime.get(),TZOffset));
    if (ReturnUTC) {
      Offset = 0}
     else Offset = -pas.SysUtils.GetLocalTimeOffset$2(ADateTime.get(),true);
    ADateTime.set($mod.IncMinute(ADateTime.get(),Offset));
    Result = true;
    return Result;
  };
  $mod.$implcode = function () {
    $impl.TDateTimeEpsilon = 2.2204460493e-16;
    $impl.MaybeSkipTimeWarp = function (OldDate, NewDate) {
      if ((OldDate >= 0) && (NewDate.get() < -2.2204460493E-16)) {
        NewDate.set(pas.System.Int((NewDate.get() - 1.0) + 2.2204460493E-16) - pas.System.Frac(1.0 + pas.System.Frac(NewDate.get())))}
       else if ((OldDate <= -1.0) && (NewDate.get() > (-1.0 + 2.2204460493E-16))) NewDate.set(pas.System.Int((NewDate.get() + 1.0) - 2.2204460493E-16) + pas.System.Frac(1.0 - Math.abs(pas.System.Frac(1.0 + NewDate.get()))));
    };
    $impl.IncNegativeTime = function (AValue, Addend) {
      var Result = 0.0;
      var newtime = 0.0;
      newtime = -pas.System.Frac(AValue) + pas.System.Frac(Addend);
      if (pas.Math.SameValue(newtime,pas.System.Int(newtime) + 1,2.2204460493E-16)) {
        newtime = pas.System.Int(newtime) + 1}
       else if (pas.Math.SameValue(newtime,pas.System.Int(newtime),2.2204460493E-16)) newtime = pas.System.Int(newtime);
      if (newtime < -2.2204460493E-16) {
        newtime = 1.0 + newtime;
        AValue = pas.System.Int(AValue) - 1;
      } else if (newtime >= (1.0 - 2.2204460493E-16)) {
        newtime = newtime - 1.0;
        AValue = pas.System.Int(AValue) + 1;
      };
      Result = (pas.System.Int(AValue) + pas.System.Int(Addend)) - newtime;
      return Result;
    };
    $impl.FmtUTC = 'yyyy"-"mm"-"dd"T"hh":"nn":"ss"."zzz';
    $impl.TryISOStrToDate = function (aString, outDate) {
      var Result = false;
      var xYear = 0;
      var xMonth = 0;
      var xDay = 0;
      var $tmp = aString.length;
      if ($tmp === 4) {
        Result = pas.SysUtils.TryStrToInt(aString,{get: function () {
            return xYear;
          }, set: function (v) {
            xYear = v;
          }}) && pas.SysUtils.TryEncodeDate(xYear,1,1,outDate)}
       else if ($tmp === 6) {
        Result = pas.SysUtils.TryStrToInt(pas.System.Copy(aString,1,4),{get: function () {
            return xYear;
          }, set: function (v) {
            xYear = v;
          }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,5,2),{get: function () {
            return xMonth;
          }, set: function (v) {
            xMonth = v;
          }}) && pas.SysUtils.TryEncodeDate(xYear,xMonth,1,outDate)}
       else if ($tmp === 7) {
        Result = pas.SysUtils.TryStrToInt(pas.System.Copy(aString,1,4),{get: function () {
            return xYear;
          }, set: function (v) {
            xYear = v;
          }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,6,2),{get: function () {
            return xMonth;
          }, set: function (v) {
            xMonth = v;
          }}) && pas.SysUtils.TryEncodeDate(xYear,xMonth,1,outDate)}
       else if ($tmp === 8) {
        Result = pas.SysUtils.TryStrToInt(pas.System.Copy(aString,1,4),{get: function () {
            return xYear;
          }, set: function (v) {
            xYear = v;
          }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,5,2),{get: function () {
            return xMonth;
          }, set: function (v) {
            xMonth = v;
          }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,7,2),{get: function () {
            return xDay;
          }, set: function (v) {
            xDay = v;
          }}) && pas.SysUtils.TryEncodeDate(xYear,xMonth,xDay,outDate)}
       else if ($tmp === 10) {
        Result = pas.SysUtils.TryStrToInt(pas.System.Copy(aString,1,4),{get: function () {
            return xYear;
          }, set: function (v) {
            xYear = v;
          }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,6,2),{get: function () {
            return xMonth;
          }, set: function (v) {
            xMonth = v;
          }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,9,2),{get: function () {
            return xDay;
          }, set: function (v) {
            xDay = v;
          }}) && pas.SysUtils.TryEncodeDate(xYear,xMonth,xDay,outDate)}
       else {
        Result = false;
      };
      if (!Result) outDate.set(0);
      return Result;
    };
    $impl.TryISOStrToTime = function (aString, outTime) {
      var Result = false;
      var xHour = 0;
      var xMinute = 0;
      var xSecond = 0;
      var xLength = 0;
      var res = 0;
      var xFractionalSecond = 0.0;
      var tmp = "";
      Result = true;
      xLength = aString.length;
      if ((xLength > 0) && (aString.charAt(xLength - 1) === "Z")) {
        xLength -= 1;
      } else if ((xLength > 6) && pas.SysUtils.CharInSet(aString.charAt(xLength - 5 - 1),["+","-"])) {
        Result = pas.SysUtils.TryStrToInt(pas.System.Copy(aString,xLength - 4,2),{get: function () {
            return xHour;
          }, set: function (v) {
            xHour = v;
          }}) && (aString.charAt(xLength - 2 - 1) === ":") && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,xLength - 1,2),{get: function () {
            return xMinute;
          }, set: function (v) {
            xMinute = v;
          }});
        xLength -= 6;
      } else if ((xLength > 5) && pas.SysUtils.CharInSet(aString.charAt(xLength - 4 - 1),["+","-"])) {
        Result = pas.SysUtils.TryStrToInt(pas.System.Copy(aString,xLength - 3,2),{get: function () {
            return xHour;
          }, set: function (v) {
            xHour = v;
          }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,xLength - 1,2),{get: function () {
            return xMinute;
          }, set: function (v) {
            xMinute = v;
          }});
        xLength -= 5;
      } else if ((xLength > 3) && pas.SysUtils.CharInSet(aString.charAt(xLength - 2 - 1),["+","-"])) {
        Result = pas.SysUtils.TryStrToInt(pas.System.Copy(aString,xLength - 1,2),{get: function () {
            return xHour;
          }, set: function (v) {
            xHour = v;
          }});
        xLength -= 3;
      };
      if (!Result) {
        outTime.set(0);
        return Result;
      };
      var $tmp = xLength;
      if ($tmp === 2) {
        Result = pas.SysUtils.TryStrToInt(aString,{get: function () {
            return xHour;
          }, set: function (v) {
            xHour = v;
          }}) && pas.SysUtils.TryEncodeTime(xHour,0,0,0,outTime)}
       else if ($tmp === 4) {
        Result = pas.SysUtils.TryStrToInt(pas.System.Copy(aString,1,2),{get: function () {
            return xHour;
          }, set: function (v) {
            xHour = v;
          }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,3,2),{get: function () {
            return xMinute;
          }, set: function (v) {
            xMinute = v;
          }}) && pas.SysUtils.TryEncodeTime(xHour,xMinute,0,0,outTime)}
       else if ($tmp === 5) {
        Result = pas.SysUtils.TryStrToInt(pas.System.Copy(aString,1,2),{get: function () {
            return xHour;
          }, set: function (v) {
            xHour = v;
          }}) && (aString.charAt(2) === ":") && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,4,2),{get: function () {
            return xMinute;
          }, set: function (v) {
            xMinute = v;
          }}) && pas.SysUtils.TryEncodeTime(xHour,xMinute,0,0,outTime)}
       else if ($tmp === 6) {
        Result = pas.SysUtils.TryStrToInt(pas.System.Copy(aString,1,2),{get: function () {
            return xHour;
          }, set: function (v) {
            xHour = v;
          }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,3,2),{get: function () {
            return xMinute;
          }, set: function (v) {
            xMinute = v;
          }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,5,2),{get: function () {
            return xSecond;
          }, set: function (v) {
            xSecond = v;
          }}) && pas.SysUtils.TryEncodeTime(xHour,xMinute,xSecond,0,outTime)}
       else {
        if ((xLength >= 8) && (aString.charAt(2) === ":") && (aString.charAt(5) === ":")) {
          Result = pas.SysUtils.TryStrToInt(pas.System.Copy(aString,1,2),{get: function () {
              return xHour;
            }, set: function (v) {
              xHour = v;
            }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,4,2),{get: function () {
              return xMinute;
            }, set: function (v) {
              xMinute = v;
            }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,7,2),{get: function () {
              return xSecond;
            }, set: function (v) {
              xSecond = v;
            }}) && pas.SysUtils.TryEncodeTime(xHour,xMinute,xSecond,0,outTime);
          if (Result && (xLength >= 9)) {
            tmp = pas.System.Copy(aString,10,xLength - 9);
            pas.System.val$8("." + tmp,{get: function () {
                return xFractionalSecond;
              }, set: function (v) {
                xFractionalSecond = v;
              }},{get: function () {
                return res;
              }, set: function (v) {
                res = v;
              }});
            Result = res === 0;
            if (Result) outTime.set(outTime.get() + (xFractionalSecond * 1.1574074074074073E-5));
          };
        } else if ((xLength >= 7) && (aString.charCodeAt(6) in rtl.createSet(46,44))) {
          Result = pas.SysUtils.TryStrToInt(pas.System.Copy(aString,1,2),{get: function () {
              return xHour;
            }, set: function (v) {
              xHour = v;
            }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,3,2),{get: function () {
              return xMinute;
            }, set: function (v) {
              xMinute = v;
            }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(aString,5,2),{get: function () {
              return xSecond;
            }, set: function (v) {
              xSecond = v;
            }}) && pas.SysUtils.TryEncodeTime(xHour,xMinute,xSecond,0,outTime);
          tmp = pas.System.Copy(aString,8,xLength - 7);
          if (Result && (tmp !== "")) {
            pas.System.val$8("." + tmp,{get: function () {
                return xFractionalSecond;
              }, set: function (v) {
                xFractionalSecond = v;
              }},{get: function () {
                return res;
              }, set: function (v) {
                res = v;
              }});
            Result = res === 0;
            if (Result) outTime.set(outTime.get() + (xFractionalSecond * 1.1574074074074073E-5));
          };
        } else Result = false;
      };
      if (!Result) outTime.set(0);
      return Result;
    };
    $impl.TryISOStrToDateTime = function (aString, outDateTime) {
      var Result = false;
      var xLength = 0;
      var sDate = "";
      var sTime = "";
      var xDate = 0.0;
      var xTime = 0.0;
      xLength = aString.length;
      if (xLength === 0) return false;
      if (aString.charAt(0) === "T") {
        Result = $impl.TryISOStrToTime(pas.System.Copy(aString,2,aString.length - 1),outDateTime);
        return Result;
      };
      if (xLength in rtl.createSet(4,7,8,10)) {
        Result = $impl.TryISOStrToDate(aString,outDateTime);
        return Result;
      };
      if ((xLength > 11) && pas.SysUtils.CharInSet(aString.charAt(10),[" ","T"])) {
        sDate = pas.System.Copy(aString,1,10);
        sTime = pas.System.Copy(aString,12,aString.length);
      } else if ((xLength > 9) && pas.SysUtils.CharInSet(aString.charAt(8),[" ","T"])) {
        sDate = pas.System.Copy(aString,1,8);
        sTime = pas.System.Copy(aString,10,aString.length);
      } else return false;
      Result = $impl.TryISOStrToDate(sDate,{get: function () {
          return xDate;
        }, set: function (v) {
          xDate = v;
        }}) && $impl.TryISOStrToTime(sTime,{get: function () {
          return xTime;
        }, set: function (v) {
          xTime = v;
        }});
      if (Result) {
        outDateTime.set(xDate + xTime)}
       else outDateTime.set(0);
      return Result;
    };
    $impl.TryISOTZStrToTZOffset = function (TZ, TZOffset) {
      var Result = false;
      var H = 0;
      var M = 0;
      Result = (TZ === "Z") || (TZ === "");
      if (Result) {
        TZOffset.set(0)}
       else {
        Result = TZ.charCodeAt(0) in rtl.createSet(43,45);
        if (!Result) return Result;
        var $tmp = TZ.length;
        if ($tmp === 3) {
          Result = pas.SysUtils.TryStrToInt(pas.System.Copy(TZ,2,2),{get: function () {
              return H;
            }, set: function (v) {
              H = v;
            }});
          M = 0;
        } else if ($tmp === 5) {
          Result = pas.SysUtils.TryStrToInt(pas.System.Copy(TZ,2,2),{get: function () {
              return H;
            }, set: function (v) {
              H = v;
            }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(TZ,4,2),{get: function () {
              return M;
            }, set: function (v) {
              M = v;
            }})}
         else if ($tmp === 6) {
          Result = pas.SysUtils.TryStrToInt(pas.System.Copy(TZ,2,2),{get: function () {
              return H;
            }, set: function (v) {
              H = v;
            }}) && pas.SysUtils.TryStrToInt(pas.System.Copy(TZ,5,2),{get: function () {
              return M;
            }, set: function (v) {
              M = v;
            }})}
         else {
          Result = false;
        };
        if (!Result) return Result;
        TZOffset.set((H * 60) + M);
        if (TZ.charAt(0) === "+") TZOffset.set(-TZOffset.get());
      };
      return Result;
    };
  };
},["RTLConsts"]);
rtl.module("Web.mORMot.Types",["System","SysUtils","JS","DateUtils"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"ERestException",pas.SysUtils.Exception,function () {
  });
  rtl.createClass(this,"EServiceException",this.ERestException,function () {
  });
});
rtl.module("Web.mORMot.StringUtils",["System","JS","Types","Web.mORMot.Types"],function () {
  "use strict";
  var $mod = this;
  rtl.createHelper(this,"TStringArrayHelper",null,function () {
    this.Join = function (separator) {
      var Result = "";
      var i = 0;
      var l = 0;
      l = rtl.length(this.get());
      for (var $l = 0, $end = l - 2; $l <= $end; $l++) {
        i = $l;
        Result = Result + this.get()[i] + separator;
      };
      Result = Result + this.get()[l - 1];
      return Result;
    };
    this.Add = function (s) {
      var l = 0;
      l = rtl.length(this.get());
      this.set(rtl.arraySetLength(this.get(),"",l + 1));
      this.get()[l] = s;
    };
    this.Clear = function () {
      this.set(rtl.arraySetLength(this.get(),"",0));
    };
  });
  this.TextToHttpBody = function (Text) {
    var Result = "";
    Result = encodeURIComponent(Text);
    return Result;
  };
});
rtl.module("Web.mORMot.CryptoUtils",["System","Web.mORMot.Types"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.crc32ascii = function (aCrc32, buf) {
    var Result = 0;
    var i = 0;
    Result = $mod.shr0(~aCrc32);
    for (var $l = 1, $end = buf.length; $l <= $end; $l++) {
      i = $l;
      Result = $mod.crc32tab[(Result ^ buf.charCodeAt(i - 1)) & 0xff] ^ (Result >>> 8);
    };
    Result = $mod.shr0(~Result);
    return Result;
  };
  this.shr0 = function (c) {
    var Result = 0;
    Result = c >>> 0;
    return Result;
  };
  this.crc32tab = [];
  $mod.$implcode = function () {
    $impl.InitCrc32Tab = function () {
      var i = 0;
      var n = 0;
      var crc = 0;
      for (i = 0; i <= 255; i++) {
        crc = i;
        for (n = 1; n <= 8; n++) if ((crc & 1) !== 0) {
          crc = $mod.shr0((crc >>> 1) ^ 0xedb88320)}
         else crc = crc >>> 1;
        $mod.crc32tab[i] = crc;
      };
    };
  };
  $mod.$init = function () {
    $impl.InitCrc32Tab();
  };
},[]);
rtl.module("Web.mORMot.SHA256",["System","SysUtils","Web","Web.mORMot.Types","Web.mORMot.StringUtils","Web.mORMot.CryptoUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.recNewT(this,"TSHAHash",function () {
    this.A = 0;
    this.B = 0;
    this.C = 0;
    this.D = 0;
    this.E = 0;
    this.F = 0;
    this.G = 0;
    this.H = 0;
    this.$eq = function (b) {
      return (this.A === b.A) && (this.B === b.B) && (this.C === b.C) && (this.D === b.D) && (this.E === b.E) && (this.F === b.F) && (this.G === b.G) && (this.H === b.H);
    };
    this.$assign = function (s) {
      this.A = s.A;
      this.B = s.B;
      this.C = s.C;
      this.D = s.D;
      this.E = s.E;
      this.F = s.F;
      this.G = s.G;
      this.H = s.H;
      return this;
    };
  });
  rtl.createClass(this,"TSHA256",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.Hash = $mod.TSHAHash.$new();
      this.MLen = 0;
      this.Buffer = rtl.arraySetLength(null,0,64);
      this.Index = 0;
    };
    this.$final = function () {
      this.Hash = undefined;
      this.Buffer = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Compress = function () {
      var W = rtl.arraySetLength(null,0,64);
      var H = $mod.TSHAHash.$new();
      var i = 0;
      var t1 = 0;
      var t2 = 0;
      H.$assign(this.Hash);
      for (i = 0; i <= 15; i++) W[i] = pas["Web.mORMot.CryptoUtils"].shr0((this.Buffer[i * 4] << 24) | (this.Buffer[(i * 4) + 1] << 16) | (this.Buffer[(i * 4) + 2] << 8) | this.Buffer[(i * 4) + 3]);
      for (i = 16; i <= 63; i++) W[i] = pas["Web.mORMot.CryptoUtils"].shr0((((W[i - 2] >>> 17) | (W[i - 2] << 15)) ^ ((W[i - 2] >>> 19) | (W[i - 2] << 13)) ^ (W[i - 2] >>> 10)) + W[i - 7] + (((W[i - 15] >>> 7) | (W[i - 15] << 25)) ^ ((W[i - 15] >>> 18) | (W[i - 15] << 14)) ^ (W[i - 15] >>> 3)) + W[i - 16]);
      for (i = 0; i <= 63; i++) {
        t1 = pas["Web.mORMot.CryptoUtils"].shr0(H.H + (((H.E >>> 6) | (H.E << 26)) ^ ((H.E >>> 11) | (H.E << 21)) ^ ((H.E >>> 25) | (H.E << 7))) + ((H.E & H.F) ^ (~H.E & H.G)) + $impl.K[i] + W[i]);
        t2 = pas["Web.mORMot.CryptoUtils"].shr0((((H.A >>> 2) | (H.A << 30)) ^ ((H.A >>> 13) | (H.A << 19)) ^ ((H.A >>> 22) ^ (H.A << 10))) + ((H.A & H.B) ^ (H.A & H.C) ^ (H.B & H.C)));
        H.H = H.G;
        H.G = H.F;
        H.F = H.E;
        H.E = pas["Web.mORMot.CryptoUtils"].shr0(H.D + t1);
        H.D = H.C;
        H.C = H.B;
        H.B = H.A;
        H.A = pas["Web.mORMot.CryptoUtils"].shr0(t1 + t2);
      };
      this.Hash.A = pas["Web.mORMot.CryptoUtils"].shr0(this.Hash.A + H.A);
      this.Hash.B = pas["Web.mORMot.CryptoUtils"].shr0(this.Hash.B + H.B);
      this.Hash.C = pas["Web.mORMot.CryptoUtils"].shr0(this.Hash.C + H.C);
      this.Hash.D = pas["Web.mORMot.CryptoUtils"].shr0(this.Hash.D + H.D);
      this.Hash.E = pas["Web.mORMot.CryptoUtils"].shr0(this.Hash.E + H.E);
      this.Hash.F = pas["Web.mORMot.CryptoUtils"].shr0(this.Hash.F + H.F);
      this.Hash.G = pas["Web.mORMot.CryptoUtils"].shr0(this.Hash.G + H.G);
      this.Hash.H = pas["Web.mORMot.CryptoUtils"].shr0(this.Hash.H + H.H);
    };
    this.Create$1 = function () {
      this.Hash.A = 0x6a09e667;
      this.Hash.B = -1150833019;
      this.Hash.C = 0x3c6ef372;
      this.Hash.D = -1521486534;
      this.Hash.E = 0x510e527f;
      this.Hash.F = -1694144372;
      this.Hash.G = 0x1f83d9ab;
      this.Hash.H = 0x5be0cd19;
      return this;
    };
    this.Update$1 = function (ascii) {
      var Len = 0;
      var aLen = 0;
      var i = 0;
      var DataNdx = 0;
      Len = ascii.length;
      DataNdx = 1;
      this.MLen += Len << 3;
      while (Len > 0) {
        aLen = 64 - this.Index;
        if (aLen <= Len) {
          for (var $l = 0, $end = aLen - 1; $l <= $end; $l++) {
            i = $l;
            this.Buffer[this.Index + i] = ascii.charCodeAt((DataNdx + i) - 1);
          };
          Len -= aLen;
          DataNdx += aLen;
          this.Compress();
          this.Index = 0;
        } else {
          for (var $l1 = 0, $end1 = Len - 1; $l1 <= $end1; $l1++) {
            i = $l1;
            this.Buffer[this.Index + i] = ascii.charCodeAt((DataNdx + i) - 1);
          };
          this.Index += Len;
          break;
        };
      };
    };
    this.Finalize = function () {
      var Result = "";
      var i = 0;
      this.Buffer[this.Index] = 0x80;
      for (var $l = this.Index + 1; $l <= 63; $l++) {
        i = $l;
        this.Buffer[i] = 0;
      };
      if (this.Index >= 56) {
        this.Compress();
        for (i = 0; i <= 59; i++) this.Buffer[i] = 0;
      };
      this.Buffer[60] = (this.MLen & 0xff000000) >>> 24;
      this.Buffer[61] = (this.MLen & 0xff0000) >>> 16;
      this.Buffer[62] = (this.MLen & 0xff00) >>> 8;
      this.Buffer[63] = this.MLen & 0xff;
      this.Compress();
      Result = pas.SysUtils.LowerCase(pas.SysUtils.IntToHex(this.Hash.A,8) + pas.SysUtils.IntToHex(this.Hash.B,8) + pas.SysUtils.IntToHex(this.Hash.C,8) + pas.SysUtils.IntToHex(this.Hash.D,8) + pas.SysUtils.IntToHex(this.Hash.E,8) + pas.SysUtils.IntToHex(this.Hash.F,8) + pas.SysUtils.IntToHex(this.Hash.G,8) + pas.SysUtils.IntToHex(this.Hash.H,8));
      return Result;
    };
  });
  this.SHA256Compute = function (Values) {
    var Result = "";
    var buf = "";
    var a = 0;
    var sha = null;
    sha = $mod.TSHA256.$create("Create$1");
    try {
      for (var $l = 0, $end = rtl.length(Values) - 1; $l <= $end; $l++) {
        a = $l;
        buf = pas["Web.mORMot.StringUtils"].TextToHttpBody(Values[a]);
        sha.Update$1(buf);
      };
      Result = sha.Finalize();
    } finally {
      sha = rtl.freeLoc(sha);
    };
    return Result;
  };
  $mod.$implcode = function () {
    $impl.K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0xfc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x6ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  };
},[]);
rtl.module("Web.JSTypes",["System","JS"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("Web.mORMot.Utils",["System","SysUtils","DateUtils","JS","Web","Web.mORMot.Types","Web.JSTypes"],function () {
  "use strict";
  var $mod = this;
  this.DateTimeToTTimeLog = function (Value) {
    var Result = 0;
    var HH = 0;
    var MM = 0;
    var SS = 0;
    var MS = 0;
    var Y = 0;
    var M = 0;
    var D = 0;
    pas.SysUtils.DecodeTime(Value,{get: function () {
        return HH;
      }, set: function (v) {
        HH = v;
      }},{get: function () {
        return MM;
      }, set: function (v) {
        MM = v;
      }},{get: function () {
        return SS;
      }, set: function (v) {
        SS = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    pas.SysUtils.DecodeDate(Value,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }});
    Result = SS + (MM * 0x40) + (((HH + (D * 0x20) + (M * 0x400) + (Y * 0x4000)) - 0x420) * 0x1000);
    return Result;
  };
  this.TTimeLogToDateTime = function (Value) {
    var Result = 0.0;
    var Y = 0;
    var M = 0;
    var D = 0;
    var Time = 0.0;
    Y = rtl.trunc(Value / 0x4000000) & 4095;
    M = 1 + (rtl.shr(Value,6 + 6 + 5 + 5) & 15);
    D = 1 + (rtl.shr(Value,6 + 6 + 5) & 31);
    if ((Y === 0) || !pas.SysUtils.TryEncodeDate(Y,M,D,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) Result = 0;
    if (((Value & ((1 << (6 + 6 + 5)) - 1)) !== 0) && pas.SysUtils.TryEncodeTime(rtl.shr(Value,6 + 6) & 31,Math.floor(Value / 64) & 63,Value & 63,0,{get: function () {
        return Time;
      }, set: function (v) {
        Time = v;
      }})) Result = Result + Time;
    return Result;
  };
  this.NowToIso8601 = function () {
    var Result = "";
    Result = $mod.DateTimeToIso8601(pas.SysUtils.Now());
    return Result;
  };
  this.DateTimeToIso8601 = function (Value) {
    var Result = "";
    Result = pas.DateUtils.DateToISO8601(Value,true);
    return Result;
  };
  this.toRawUtf8 = function (Value) {
    var Result = "";
    if (rtl.isString(Value)) {
      Result = "" + Value}
     else Result = "";
    return Result;
  };
  this.toDouble = function (Value) {
    var Result = 0.0;
    Result = pas.JS.toNumber(Value);
    return Result;
  };
  this.Iso8601ToDateTime = function (Value) {
    var Result = 0.0;
    if (rtl.isNumber(Value)) {
      Result = $mod.toDouble(Value)}
     else Result = pas.DateUtils.ISO8601ToDate(pas.JS.ToString(Value),true);
    return Result;
  };
});
rtl.module("Web.mORMot.RestTypes",["System","Web","JS","Web.mORMot.Types"],function () {
  "use strict";
  var $mod = this;
  rtl.recNewT(this,"TRestURIParams",function () {
    this.Url = "";
    this.UrlWithoutSignature = "";
    this.Verb = "";
    this.InHead = "";
    this.InBody = "";
    this.OutHead = "";
    this.OutBody = "";
    this.OutStatus = 0;
    this.XHR = null;
    this.OnSuccess = null;
    this.OnError = null;
    this.$eq = function (b) {
      return (this.Url === b.Url) && (this.UrlWithoutSignature === b.UrlWithoutSignature) && (this.Verb === b.Verb) && (this.InHead === b.InHead) && (this.InBody === b.InBody) && (this.OutHead === b.OutHead) && (this.OutBody === b.OutBody) && (this.OutStatus === b.OutStatus) && (this.XHR === b.XHR) && rtl.eqCallback(this.OnSuccess,b.OnSuccess) && rtl.eqCallback(this.OnError,b.OnError);
    };
    this.$assign = function (s) {
      this.Url = s.Url;
      this.UrlWithoutSignature = s.UrlWithoutSignature;
      this.Verb = s.Verb;
      this.InHead = s.InHead;
      this.InBody = s.InBody;
      this.OutHead = s.OutHead;
      this.OutBody = s.OutBody;
      this.OutStatus = s.OutStatus;
      this.XHR = s.XHR;
      this.OnSuccess = s.OnSuccess;
      this.OnError = s.OnError;
      return this;
    };
    this.Init = function (aUrl, aVerb, aUTF8Body) {
      this.Url = aUrl;
      this.Verb = aVerb;
      if (aUTF8Body === "") return;
      this.InBody = aUTF8Body;
    };
  });
  rtl.recNewT(this,"TRestConnectionParams",function () {
    this.Server = "";
    this.Port = 0;
    this.Https = false;
    this.$eq = function (b) {
      return (this.Server === b.Server) && (this.Port === b.Port) && (this.Https === b.Https);
    };
    this.$assign = function (s) {
      this.Server = s.Server;
      this.Port = s.Port;
      this.Https = s.Https;
      return this;
    };
  });
  rtl.recNewT(this,"TResult",function () {
    this.result = "";
    this.$eq = function (b) {
      return this.result === b.result;
    };
    this.$assign = function (s) {
      this.result = s.result;
      return this;
    };
  });
});
rtl.module("Web.mORMot.OrmTypes",["System","Classes","Web.mORMot.Types","Web.mORMot.Utils"],function () {
  "use strict";
  var $mod = this;
  this.$rtti.$Class("TOrm");
  rtl.createClass(this,"TOrm",pas.Classes.TPersistent,function () {
    this.$init = function () {
      pas.Classes.TPersistent.$init.call(this);
      this.fID = 0;
    };
    this.Create$1 = function () {
      return this;
    };
    var $r = this.$rtti;
    $r.addMethod("Create$1",2,[]);
    $r.addProperty("ID",0,rtl.nativeint,"fID","fID");
  });
  rtl.createClass(this,"TORMModel",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fRoot = "";
    };
    this.Create$1 = function (Tables, aRoot) {
      if (aRoot !== "") if (aRoot.charAt(aRoot.length - 1) === "/") {
        this.fRoot = pas.System.Copy(aRoot,1,aRoot.length - 1)}
       else this.fRoot = aRoot;
      return this;
    };
  });
});
rtl.module("Web.mORMot.AuthTypes",["System","JS","Web.mORMot.SHA256","Web.mORMot.StringUtils","Web.mORMot.Types","Web.JSTypes","Web.mORMot.Utils","Web.mORMot.OrmTypes"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TAuthGroup",pas["Web.mORMot.OrmTypes"].TOrm,function () {
    this.$init = function () {
      pas["Web.mORMot.OrmTypes"].TOrm.$init.call(this);
      this.fIdent = "";
      this.fAccessRights = "";
      this.fSessionTimeOut = 0;
    };
    var $r = this.$rtti;
    $r.addProperty("Ident",0,rtl.string,"fIdent","fIdent");
    $r.addProperty("SessionTimeout",0,rtl.longint,"fSessionTimeOut","fSessionTimeOut");
    $r.addProperty("AccessRights",0,rtl.string,"fAccessRights","fAccessRights");
  });
  rtl.createClass(this,"TAuthUser",pas["Web.mORMot.OrmTypes"].TOrm,function () {
    this.$init = function () {
      pas["Web.mORMot.OrmTypes"].TOrm.$init.call(this);
      this.fLogonName = "";
      this.fPasswordHashHexa = "";
      this.fDisplayName = "";
      this.fData = undefined;
      this.fGroup = 0;
    };
    this.SetPasswordPlain = function (Value) {
      this.fPasswordHashHexa = pas["Web.mORMot.SHA256"].SHA256Compute(["salt",Value]);
    };
    var $r = this.$rtti;
    $r.addProperty("LogonName",0,rtl.string,"fLogonName","fLogonName");
    $r.addProperty("DisplayName",0,rtl.string,"fDisplayName","fDisplayName");
    $r.addProperty("PasswordHashHexa",0,rtl.string,"fPasswordHashHexa","fPasswordHashHexa");
    $r.addProperty("GroupRights",0,rtl.nativeint,"fGroup","fGroup");
    $r.addProperty("Data",0,rtl.jsvalue,"fData","fData");
  });
});
rtl.module("strutils",["System","SysUtils","Types"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.Soundex = function (AText, ALength) {
    var Result = "";
    var S = "\x00";
    var PS = "\x00";
    var I = 0;
    var L = 0;
    Result = "";
    PS = "\x00";
    if (AText.length > 0) {
      Result = pas.System.upcase(AText.charAt(0));
      I = 2;
      L = AText.length;
      while ((I <= L) && (Result.length < ALength)) {
        S = $impl.SScore.charAt(AText.charCodeAt(I - 1) - 1);
        if (!(S.charCodeAt() in rtl.createSet(48,105,PS.charCodeAt()))) Result = Result + S;
        if (S !== "i") PS = S;
        I += 1;
      };
    };
    L = Result.length;
    if (L < ALength) Result = Result + pas.System.StringOfChar("0",ALength - L);
    return Result;
  };
  this.SoundexSimilar = function (AText, AOther, ALength) {
    var Result = false;
    Result = $mod.Soundex(AText,ALength) === $mod.Soundex(AOther,ALength);
    return Result;
  };
  this.SoundexSimilar$1 = function (AText, AOther) {
    var Result = false;
    Result = $mod.SoundexSimilar(AText,AOther,4);
    return Result;
  };
  this.SoundexProc = function (AText, AOther) {
    var Result = false;
    Result = $mod.SoundexSimilar$1(AText,AOther);
    return Result;
  };
  this.AnsiResemblesProc = null;
  this.ResemblesProc = null;
  this.SplitString = function (S, Delimiters) {
    var Result = [];
    Result = pas.SysUtils.TStringHelper.Split.call({get: function () {
        return S;
      }, set: function (v) {
        rtl.raiseE("EPropReadOnly");
      }},Delimiters);
    return Result;
  };
  $mod.$implcode = function () {
    $impl.SScore = "00000000000000000000000000000000" + "00000000000000000000000000000000" + "0123012i02245501262301i2i2" + "000000" + "0123012i02245501262301i2i2" + "00000000000000000000000000000000" + "00000000000000000000000000000000" + "00000000000000000000000000000000" + "00000000000000000000000000000000" + "00000";
  };
  $mod.$init = function () {
    $mod.AnsiResemblesProc = $mod.SoundexProc;
    $mod.ResemblesProc = $mod.SoundexProc;
  };
},["JS"]);
rtl.module("Web.mORMot.HttpTypes",["System"],function () {
  "use strict";
  var $mod = this;
  this.JSON_CONTENT_TYPE = "application/json; charset=UTF-8";
  this.HTTP_SUCCESS = 200;
  this.HTTP_NOTIMPLEMENTED = 501;
  this.HTTP_UNAVAILABLE = 503;
  this.INTERNET_DEFAULT_HTTP_PORT = 80;
  this.INTERNET_DEFAULT_HTTPS_PORT = 443;
});
rtl.module("Web.mORMot.RestUtils",["System","SysUtils","strutils","JS","Web","Types","Web.mORMot.Types","Web.mORMot.RestTypes","Web.mORMot.HttpTypes","Web.mORMot.StringUtils"],function () {
  "use strict";
  var $mod = this;
  this.CallGetResult = function (aCall, outID) {
    var Result = null;
    outID.set(0);
    if (aCall.OutStatus !== 200) return Result;
    Result = JSON.parse(aCall.OutBody);
    return Result;
  };
  this.FindHeader = function (Headers, Name) {
    var Result = "";
    var search = "";
    var nameValue = "";
    var searchLen = 0;
    var arr = [];
    if (Headers === "") return "";
    search = pas.SysUtils.UpperCase(Name);
    searchLen = search.length;
    arr = pas.strutils.SplitString(Headers,"\r\n");
    for (var $in = arr, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
      nameValue = $in[$l];
      if (pas.SysUtils.UpperCase(pas.System.Copy(nameValue,1,searchLen)) === search) return pas.System.Copy(nameValue,searchLen + 1,nameValue.length);
    };
    return Result;
  };
  this.GetNextCSV = function (str, index, res, Sep, resultTrim) {
    var Result = false;
    var i = 0;
    var j = 0;
    var L = 0;
    L = str.length;
    if (index.get() <= L) {
      i = index.get();
      while (i <= L) if (str.charAt(i - 1) === Sep) {
        break}
       else i += 1;
      j = index.get();
      index.set(i + 1);
      if (resultTrim) {
        while ((j < L) && (str.charCodeAt(j - 1) <= 32)) j += 1;
        while ((i > j) && (str.charCodeAt(i - 1 - 1) <= 32)) i -= 1;
      };
      res.set(pas.System.Copy(str,j,i - j));
      Result = true;
    } else Result = false;
    return Result;
  };
  this.GetOutHeader = function (Call, Name) {
    var Result = "";
    Result = $mod.FindHeader(Call.OutHead,Name + ": ");
    return Result;
  };
  this.TVarRecToString = function (v) {
    var Result = "";
    if (!pas.JS.hasValue(v.VJSValue)) return "";
    if (rtl.isString(v.VJSValue)) {
      Result = pas.JS.ToString(v.VJSValue)}
     else if (pas.JS.isInteger(v.VJSValue)) {
      Result = pas.SysUtils.IntToStr(pas.JS.toInteger(v.VJSValue))}
     else if (rtl.isNumber(v.VJSValue)) {
      Result = pas.SysUtils.FloatToStr(pas.JS.toNumber(v.VJSValue))}
     else Result = "";
    return Result;
  };
  this.UrlEncode = function (aValue) {
    var Result = "";
    Result = encodeURIComponent(aValue);
    return Result;
  };
  this.UrlEncode$1 = function (aNameValueParameters) {
    var Result = "";
    var i = 0;
    var n = 0;
    var a = 0;
    var name = "";
    var value = "";
    Result = "";
    n = rtl.length(aNameValueParameters) - 1;
    if (n > 0) {
      for (var $l = 0, $end = rtl.trunc(n / 2); $l <= $end; $l++) {
        a = $l;
        name = $mod.TVarRecToString(pas.System.TVarRec.$clone(aNameValueParameters[a * 2]));
        for (var $l1 = 1, $end1 = name.length; $l1 <= $end1; $l1++) {
          i = $l1;
          if (!(name.charCodeAt(i - 1) in rtl.createSet(null,97,122,null,65,90))) throw pas["Web.mORMot.Types"].ERestException.$create("CreateFmt",['UrlEncode() expect alphabetic names, not "%s"',pas.System.VarRecs(18,name)]);
        };
        value = $mod.TVarRecToString(pas.System.TVarRec.$clone(aNameValueParameters[(a * 2) + 1]));
        Result = Result + "&" + name + "=" + $mod.UrlEncode(value);
      };
    };
    if (Result !== "") Result = rtl.setCharAt(Result,0,"?");
    return Result;
  };
});
rtl.module("Web.mORMot.Routing",["System"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TRestRoutingAbstract",pas.System.TObject,function () {
  });
  rtl.createClass(this,"TRestRoutingREST",this.TRestRoutingAbstract,function () {
    this.ClientSideInvoke = function (uri, method, params, clientDrivenID, sent) {
      if (clientDrivenID !== "") {
        uri.set(uri.get() + "." + method + "/" + clientDrivenID)}
       else uri.set(uri.get() + "." + method);
      sent.set(params);
    };
  });
});
rtl.module("Web.mORMot.Http",["System","SysUtils","JS","Web","Web.mORMot.RestTypes","Web.mORMot.RestUtils","Web.mORMot.HttpTypes"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TAbstractHttpConnection",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fParameters = pas["Web.mORMot.RestTypes"].TRestConnectionParams.$new();
      this.fURL = "";
    };
    this.$final = function () {
      this.fParameters = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (aParameters) {
      pas.System.TObject.Create.call(this);
      this.fParameters.$assign(aParameters);
      if (this.fParameters.Port === 0) if (this.fParameters.Https) {
        this.fParameters.Port = 443}
       else this.fParameters.Port = 80;
      if (this.fParameters.Https) {
        this.fURL = "https://"}
       else this.fURL = "http://";
      this.fURL = this.fURL + this.fParameters.Server + ":" + pas.SysUtils.IntToStr(this.fParameters.Port) + "/";
      return this;
    };
  });
  rtl.createClass(this,"TWebHttpConnectionClass",this.TAbstractHttpConnection,function () {
    this.URI = function (Call, InDataType, KeepAlive) {
      var $Self = this;
      var i = 0;
      var l = 0;
      var line = "";
      var head = "";
      var value = "";
      Call.XHR = new XMLHttpRequest();
      if (Call.OnSuccess != null) {
        Call.XHR.onreadystatechange = function () {
          if (Call.XHR.readyState === 4) {
            Call.XHR.onreadystatechange = null;
            Call.OutStatus = Call.XHR.status;
            Call.OutHead = Call.XHR.getAllResponseHeaders();
            Call.OutBody = Call.XHR.responseText;
            Call.OnSuccess();
          };
        };
        Call.XHR.open(Call.Verb,this.fURL + Call.Url,true);
      } else Call.XHR.open(Call.Verb,this.fURL + Call.Url,false);
      if (Call.InHead !== "") {
        i = 1;
        while (pas["Web.mORMot.RestUtils"].GetNextCSV(Call.InHead,{get: function () {
            return i;
          }, set: function (v) {
            i = v;
          }},{get: function () {
            return line;
          }, set: function (v) {
            line = v;
          }},"\n",false)) {
          l = pas.System.Pos(":",line);
          if (l === 0) continue;
          head = pas.SysUtils.Trim(pas.System.Copy(line,1,l - 1));
          value = pas.SysUtils.Trim(pas.System.Copy(line,l + 1,line.length));
          if ((head !== "") && (value !== "")) Call.XHR.setRequestHeader(head,value);
        };
      };
      if (Call.InBody === "") {
        Call.XHR.send(null)}
       else Call.XHR.send(Call.InBody);
      if (!(Call.OnSuccess != null)) {
        Call.OutStatus = Call.XHR.status;
        Call.OutHead = Call.XHR.getAllResponseHeaders();
        Call.OutBody = Call.XHR.responseText;
      };
    };
  });
  this.HttpConnectionClass = function () {
    var Result = null;
    Result = $mod.TWebHttpConnectionClass;
    return Result;
  };
});
rtl.module("Web.mORMot.Rest",["System","SysUtils","Classes","Web","JS","Types","Web.mORMot.SHA256","Web.mORMot.StringUtils","Web.mORMot.Utils","Web.mORMot.Types","Web.mORMot.RestTypes","Web.mORMot.OrmTypes","Web.mORMot.AuthTypes","Web.mORMot.RestUtils","Web.mORMot.Routing","Web.mORMot.HttpTypes","Web.mORMot.Http","Web.mORMot.CryptoUtils"],function () {
  "use strict";
  var $mod = this;
  this.TServiceInstanceImplementation = {"0": "sicSingle", sicSingle: 0, "1": "sicShared", sicShared: 1, "2": "sicClientDriven", sicClientDriven: 2, "3": "sicPerSession", sicPerSession: 3, "4": "sicPerUser", sicPerUser: 4, "5": "sicPerGroup", sicPerGroup: 5, "6": "sicPerThread", sicPerThread: 6};
  rtl.createClass(this,"TServiceClientAbstract",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fClient = null;
      this.fServiceName = "";
      this.fServiceURI = "";
      this.fInstanceImplementation = 0;
      this.fContractExpected = "";
    };
    this.$final = function () {
      this.fClient = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (aClient) {
      var Call = pas["Web.mORMot.RestTypes"].TRestURIParams.$new();
      var dummyID = 0;
      var contract = "";
      var rtn = null;
      var arr = null;
      var jsv = undefined;
      if ((this.fServiceName === "") || (this.fServiceURI === "")) throw pas["Web.mORMot.Types"].EServiceException.$create("CreateFmt",["Overriden %s.Create should have set properties",pas.System.VarRecs(18,this.$classname)]);
      if (aClient === null) throw pas["Web.mORMot.Types"].EServiceException.$create("CreateFmt",["%s.Create(nil)",pas.System.VarRecs(18,this.$classname)]);
      this.fClient = aClient;
      this.fClient.CallRemoteServiceInternal(Call,this,$mod.SERVICE_PSEUDO_METHOD[1],"[]");
      rtn = pas["Web.mORMot.RestUtils"].CallGetResult(Call,{get: function () {
          return dummyID;
        }, set: function (v) {
          dummyID = v;
        }});
      jsv = rtn["result"];
      if (rtl.isArray(jsv)) {
        arr = jsv;
        contract = "" + arr[0];
      } else contract = "" + jsv;
      if (contract !== this.fContractExpected) throw pas["Web.mORMot.Types"].EServiceException.$create("CreateFmt",['Invalid contract "%s" for %s: expected "%s"',pas.System.VarRecs(18,contract,18,this.$classname,18,this.fContractExpected)]);
      return this;
    };
  });
  rtl.createClass(this,"TRest",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fModel = null;
      this.fServerTimeStampOffset = 0.0;
      this.fServicesRouting = null;
      this.fInternalState = 0;
      this.fOwnModel = false;
    };
    this.$final = function () {
      this.fModel = undefined;
      this.fServicesRouting = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.GetServerTimeStamp = function () {
      var Result = 0;
      if (this.fServerTimeStampOffset === 0) {
        Result = 0}
       else Result = pas["Web.mORMot.Utils"].DateTimeToTTimeLog(pas.SysUtils.Now() + this.fServerTimeStampOffset);
      return Result;
    };
    this.SetServerTimeStamp = function (ServerResponse) {
      var Result = false;
      var TimeStamp = 0;
      if (!pas.SysUtils.TryStrToInt64$1(ServerResponse,{get: function () {
          return TimeStamp;
        }, set: function (v) {
          TimeStamp = v;
        }})) {
        Result = false}
       else {
        this.fServerTimeStampOffset = pas["Web.mORMot.Utils"].TTimeLogToDateTime(TimeStamp) - pas.SysUtils.Now();
        if (this.fServerTimeStampOffset === 0) this.fServerTimeStampOffset = 0.000001;
        Result = true;
      };
      return Result;
    };
    this.Create$1 = function (aModel, aOwnModel) {
      pas.System.TObject.Create.call(this);
      this.fModel = aModel;
      this.fOwnModel = aOwnModel;
      this.fServicesRouting = pas["Web.mORMot.Routing"].TRestRoutingREST;
      return this;
    };
    this.Destroy = function () {
      pas.System.TObject.Destroy.call(this);
      if (this.fOwnModel) rtl.free(this,"fModel");
    };
  });
  rtl.createClass(this,"TRestClientURI",this.TRest,function () {
    this.$init = function () {
      $mod.TRest.$init.call(this);
      this.fAuthentication = null;
      this.fOnlyJSONRequests = false;
      this.fAsynchCount = 0;
      this.fAsynchPendingText = [];
    };
    this.$final = function () {
      this.fAuthentication = undefined;
      this.fAsynchPendingText = undefined;
      $mod.TRest.$final.call(this);
    };
    this.CallAsynchText = function () {
      var $Self = this;
      var Call = pas["Web.mORMot.RestTypes"].TRestURIParams.$new();
      if (rtl.length(this.fAsynchPendingText) === 0) return;
      Call.Init(this.getURICallBack("RemoteLog",null,0),"PUT",pas["Web.mORMot.StringUtils"].TStringArrayHelper.Join.call({p: this, get: function () {
          return this.p.fAsynchPendingText;
        }, set: function (v) {
          this.p.fAsynchPendingText = v;
        }},"\r\n"));
      pas["Web.mORMot.StringUtils"].TStringArrayHelper.Clear.call({p: this, get: function () {
          return this.p.fAsynchPendingText;
        }, set: function (v) {
          this.p.fAsynchPendingText = v;
        }});
      this.SetAsynch(Call,function (Client) {
      },null,null);
      this.URI(Call);
    };
    this.SetAsynch = function (Call, onSuccess, onError, onBeforeSuccess) {
      var $Self = this;
      if (!(onSuccess != null)) throw pas["Web.mORMot.Types"].ERestException.$create("Create$1",["SetAsynch expects onSuccess"]);
      this.fAsynchCount += 1;
      Call.OnSuccess = function () {
        if (Call.XHR.readyState === 4) {
          $Self.InternalStateUpdate(Call);
          if (!(onBeforeSuccess != null)) {
            onSuccess($Self)}
           else if (onBeforeSuccess()) {
            onSuccess($Self)}
           else if (onError != null) onError($Self);
          if ($Self.fAsynchCount > 0) $Self.fAsynchCount -= 1;
          if ($Self.fAsynchCount === 0) $Self.CallAsynchText();
        };
      };
      Call.OnError = function () {
        if (onError != null) onError($Self);
        if ($Self.fAsynchCount > 0) $Self.fAsynchCount -= 1;
        if ($Self.fAsynchCount === 0) $Self.CallAsynchText();
      };
    };
    this.getURI = function (aTable) {
      var Result = "";
      Result = this.fModel.fRoot;
      return Result;
    };
    this.getURICallBack = function (aMethodName, aTable, aID) {
      var Result = "";
      Result = this.getURI(aTable);
      if (aID > 0) Result = Result + "/" + pas.SysUtils.IntToStr(aID);
      Result = Result + "/" + aMethodName;
      return Result;
    };
    this.InternalStateUpdate = function (Call) {
      var receivedState = 0;
      if (Call.OutHead === "") return;
      receivedState = pas.SysUtils.StrToIntDef(pas["Web.mORMot.RestUtils"].GetOutHeader(Call,"Server-InternalState"),0);
      if (receivedState > this.fInternalState) this.fInternalState = receivedState;
    };
    this.CallRemoteServiceInternal = function (Call, aCaller, aMethod, aParams) {
      var url = "";
      var clientDrivenID = "";
      var sent = "";
      var methName = "";
      methName = aCaller.fServiceURI + "." + aMethod;
      url = this.fModel.fRoot + "/" + aCaller.fServiceURI;
      this.fServicesRouting.ClientSideInvoke({get: function () {
          return url;
        }, set: function (v) {
          url = v;
        }},aMethod,aParams,clientDrivenID,{get: function () {
          return sent;
        }, set: function (v) {
          sent = v;
        }});
      Call.Init(url,"POST",sent);
      this.URI(Call);
      this.InternalServiceCheck(methName,Call);
    };
    this.InternalServiceCheck = function (aMethodName, Call) {
      if (Call.OnSuccess != null) return;
    };
    this.Destroy = function () {
      this.SessionClose();
      $mod.TRest.Destroy.call(this);
    };
    this.Connect = function (onSuccess, onError) {
      var $Self = this;
      var Call = pas["Web.mORMot.RestTypes"].TRestURIParams.$new();
      this.SetAsynch(Call,onSuccess,onError,function () {
        var Result = false;
        Result = (Call.OutStatus === 200) && $Self.SetServerTimeStamp(Call.OutBody);
        return Result;
      });
      this.CallBackGet("TimeStamp",[],Call,null,0);
    };
    this.URI = function (Call) {
      var sign = "";
      Call.OutStatus = 503;
      if (this === null) return;
      Call.UrlWithoutSignature = Call.Url;
      if ((this.fAuthentication !== null) && (this.fAuthentication.fSessionID !== 0)) {
        if (pas.System.Pos("?",Call.Url) === 0) {
          sign = "?session_signature="}
         else sign = "&session_signature=";
        Call.Url = Call.Url + sign + this.fAuthentication.ClientSessionComputeSignature(this,Call.Url);
      };
      this.InternalURI(Call);
      this.InternalStateUpdate(Call);
    };
    this.CallBackGet = function (aMethodName, aNameValueParameters, Call, aTable, aID) {
      Call.Url = this.getURICallBack(aMethodName,aTable,aID) + pas["Web.mORMot.RestUtils"].UrlEncode$1(aNameValueParameters);
      Call.Verb = "GET";
      this.URI(Call);
      this.InternalServiceCheck(aMethodName,Call);
    };
    this.CallBackGetResult = function (aMethodName, aNameValueParameters, aTable, aID) {
      var Result = "";
      var Call = pas["Web.mORMot.RestTypes"].TRestURIParams.$new();
      var dummyID = 0;
      var res = undefined;
      var rec = pas["Web.mORMot.RestTypes"].TResult.$new();
      this.CallBackGet(aMethodName,aNameValueParameters,Call,aTable,aID);
      res = pas["Web.mORMot.RestUtils"].CallGetResult(Call,{get: function () {
          return dummyID;
        }, set: function (v) {
          dummyID = v;
        }});
      rec.$assign(rtl.getObject(res));
      Result = rec.result;
      return Result;
    };
    this.SetUser = function (aAuthenticationClass, aUserName, aPassword, aHashedPassword) {
      var Result = false;
      var aKey = "";
      var aSessionID = "";
      var i = 0;
      Result = false;
      if (this.fAuthentication !== null) this.SessionClose();
      if (aAuthenticationClass === null) return Result;
      this.fAuthentication = aAuthenticationClass.$create("Create$1",[aUserName,aPassword,aHashedPassword]);
      try {
        aKey = this.fAuthentication.ClientComputeSessionKey(this);
        i = 1;
        pas["Web.mORMot.RestUtils"].GetNextCSV(aKey,{get: function () {
            return i;
          }, set: function (v) {
            i = v;
          }},{get: function () {
            return aSessionID;
          }, set: function (v) {
            aSessionID = v;
          }},"+",false);
        if (pas.SysUtils.TryStrToInt(aSessionID,{get: function () {
            return i;
          }, set: function (v) {
            i = v;
          }}) && (i > 0)) {
          this.fAuthentication.SetSessionID(i);
          Result = true;
        } else {
          rtl.free(this,"fAuthentication");
          this.fAuthentication = null;
        };
      } catch ($e) {
        rtl.free(this,"fAuthentication");
        this.fAuthentication = null;
      };
      return Result;
    };
    this.SessionClose = function () {
      var Call = pas["Web.mORMot.RestTypes"].TRestURIParams.$new();
      if ((this !== null) && (this.fAuthentication !== null)) try {
        this.CallBackGet("Auth",pas.System.VarRecs(18,"UserName",18,this.fAuthentication.fUser.fLogonName,18,"Session",19,this.fAuthentication.fSessionID),Call,null,0);
      } finally {
        rtl.free(this,"fAuthentication");
        this.fAuthentication = null;
      };
    };
    this.CallRemoteServiceAsynch = function (aCaller, aMethodName, aExpectedOutputParamsCount, aInputParams, onSuccess, onError, aReturnsCustomAnswer) {
      var $Self = this;
      var Call = pas["Web.mORMot.RestTypes"].TRestURIParams.$new();
      var jsv = undefined;
      var arrResults = [];
      this.SetAsynch(Call,function (Client) {
        var outID = 0;
        var arr = [];
        var rtn = null;
        if (!(onSuccess != null)) return;
        if (aReturnsCustomAnswer) {
          if (Call.OutStatus === 200) {
            pas["Web.mORMot.StringUtils"].TStringArrayHelper.Add.call({get: function () {
                return arr;
              }, set: function (v) {
                arr = v;
              }},Call.OutBody);
            onSuccess(rtl.arrayRef(arr));
          } else if (onError != null) onError($Self);
          return;
        };
        rtn = pas["Web.mORMot.RestUtils"].CallGetResult(Call,{get: function () {
            return outID;
          }, set: function (v) {
            outID = v;
          }});
        if (rtn != null) {
          if (aExpectedOutputParamsCount === 0) {
            onSuccess([])}
           else {
            jsv = rtn["result"];
            if (rtl.isArray(jsv)) {
              arrResults = jsv;
              if (rtl.length(arrResults) === aExpectedOutputParamsCount) {
                onSuccess(rtl.arrayRef(arrResults))}
               else if (onError != null) onError($Self);
            };
          };
        };
      },onError,function () {
        var Result = false;
        Result = (Call.OutStatus === 200) && (Call.OutBody !== "");
        return Result;
      });
      this.CallRemoteServiceInternal(Call,aCaller,aMethodName,JSON.stringify(aInputParams));
    };
    this.CallRemoteServiceSynch = function (aCaller, aMethodName, aExpectedOutputParamsCount, aInputParams, aReturnsCustomAnswer) {
      var $Self = this;
      var Result = [];
      var Call = pas["Web.mORMot.RestTypes"].TRestURIParams.$new();
      var outResult = null;
      var outID = 0;
      var jsv = undefined;
      var arrResults = [];
      function RaiseError() {
        throw pas["Web.mORMot.Types"].EServiceException.$create("CreateFmt",["Error calling %s.%s - returned status %d",pas.System.VarRecs(18,aCaller.fServiceName,18,aMethodName,19,Call.OutStatus)]);
      };
      this.CallRemoteServiceInternal(Call,aCaller,aMethodName,JSON.stringify(aInputParams));
      if (aReturnsCustomAnswer) {
        if (Call.OutStatus !== 200) RaiseError();
        Result.push(Call.OutBody);
        return Result;
      };
      outResult = pas["Web.mORMot.RestUtils"].CallGetResult(Call,{get: function () {
          return outID;
        }, set: function (v) {
          outID = v;
        }});
      if (!(outResult != null)) RaiseError();
      if (aExpectedOutputParamsCount === 0) return Result;
      if (outResult != null) {
        jsv = outResult["result"];
        if (rtl.isArray(jsv)) {
          arrResults = jsv;
          if (rtl.length(arrResults) === aExpectedOutputParamsCount) {
            Result = rtl.arrayRef(arrResults)}
           else throw pas["Web.mORMot.Types"].EServiceException.$create("CreateFmt",["Error calling %s.%s - " + "received %d parameters (expected %d)",pas.System.VarRecs(18,aCaller.fServiceName,18,aMethodName,19,rtl.length(arrResults),0,aExpectedOutputParamsCount)]);
        };
      };
      return Result;
    };
  });
  rtl.createClass(this,"TRestClientHTTP",this.TRestClientURI,function () {
    this.$init = function () {
      $mod.TRestClientURI.$init.call(this);
      this.fConnection = null;
      this.fParameters = pas["Web.mORMot.RestTypes"].TRestConnectionParams.$new();
      this.fKeepAlive = 0;
      this.fCustomHttpHeader = "";
      this.fForceTerminate = false;
    };
    this.$final = function () {
      this.fConnection = undefined;
      this.fParameters = undefined;
      $mod.TRestClientURI.$final.call(this);
    };
    this.InternalURI = function (Call) {
      var inType = "";
      var retry = 0;
      inType = pas["Web.mORMot.RestUtils"].FindHeader(Call.InHead,"content-type: ");
      if (inType === "") {
        if (this.fOnlyJSONRequests) {
          inType = pas["Web.mORMot.HttpTypes"].JSON_CONTENT_TYPE}
         else inType = "text/plain";
        Call.InHead = pas.SysUtils.Trim(Call.InHead + "\r\ncontent-type: " + inType);
      };
      if (this.fCustomHttpHeader !== "") Call.InHead = pas.SysUtils.Trim(Call.InHead + this.fCustomHttpHeader);
      for (retry = 0; retry <= 1; retry++) {
        if (this.fConnection === null) try {
          this.fConnection = pas["Web.mORMot.Http"].HttpConnectionClass().$create("Create$1",[this.fParameters]);
        } catch ($e) {
          if (pas.SysUtils.Exception.isPrototypeOf($e)) {
            var E = $e;
            rtl.free(this,"fConnection");
            this.fConnection = null;
          } else throw $e
        };
        if (this.fConnection === null) {
          Call.OutStatus = 501;
          break;
        };
        try {
          this.fConnection.URI(Call,inType,this.fKeepAlive);
          break;
        } catch ($e) {
          if (pas.SysUtils.Exception.isPrototypeOf($e)) {
            var E = $e;
            rtl.free(this,"fConnection");
            this.fConnection = null;
            Call.OutStatus = 501;
            if (this.fForceTerminate) break;
          } else throw $e
        };
      };
    };
    this.Create$2 = function (aServer, aPort, aModel, aOwnModel, aHttps) {
      $mod.TRest.Create$1.call(this,aModel,aOwnModel);
      this.fParameters.Server = aServer;
      this.fParameters.Port = aPort;
      this.fParameters.Https = aHttps;
      this.fKeepAlive = 20000;
      return this;
    };
    this.Destroy = function () {
      $mod.TRestClientURI.Destroy.call(this);
      rtl.free(this,"fAuthentication");
      rtl.free(this,"fConnection");
    };
  });
  rtl.createClass(this,"TRestServerAuthentication",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fUser = null;
      this.fSessionID = 0;
      this.fSessionIDHexa8 = "";
    };
    this.$final = function () {
      this.fUser = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.SetSessionID = function (Value) {
      this.fSessionID = Value;
      this.fSessionIDHexa8 = pas.SysUtils.LowerCase(pas.SysUtils.IntToHex(Value,8));
    };
    this.Create$1 = function (aUserName, aPassword, aHashedPassword) {
      this.fUser = pas["Web.mORMot.AuthTypes"].TAuthUser.$create("Create$1");
      this.fUser.fLogonName = aUserName;
      if (aHashedPassword) {
        this.fUser.fPasswordHashHexa = aPassword}
       else this.fUser.SetPasswordPlain(aPassword);
      return this;
    };
    this.Destroy = function () {
      rtl.free(this,"fUser");
      pas.System.TObject.Destroy.call(this);
    };
  });
  rtl.createClass(this,"TRestServerAuthenticationDefault",this.TRestServerAuthentication,function () {
    this.$init = function () {
      $mod.TRestServerAuthentication.$init.call(this);
      this.fSessionPrivateKey = 0;
    };
    this.ClientComputeSessionKey = function (Sender) {
      var Result = "";
      var aServerNonce = "";
      var aClientNonce = "";
      var aPassHash = "";
      var s = "";
      if (this.fUser.fLogonName === "") return Result;
      aServerNonce = Sender.CallBackGetResult("Auth",pas.System.VarRecs(18,"UserName",18,this.fUser.fLogonName),null,0);
      if (aServerNonce === "") return Result;
      s = pas.System.Copy(pas["Web.mORMot.Utils"].NowToIso8601(),1,16);
      aClientNonce = pas["Web.mORMot.SHA256"].SHA256Compute([s]);
      aPassHash = pas["Web.mORMot.SHA256"].SHA256Compute([Sender.fModel.fRoot,aServerNonce,aClientNonce,this.fUser.fLogonName,this.fUser.fPasswordHashHexa]);
      Result = Sender.CallBackGetResult("Auth",pas.System.VarRecs(18,"UserName",18,this.fUser.fLogonName,18,"Password",18,aPassHash,18,"ClientNonce",18,aClientNonce),null,0);
      this.fSessionPrivateKey = pas["Web.mORMot.CryptoUtils"].crc32ascii(pas["Web.mORMot.CryptoUtils"].crc32ascii(0,Result),this.fUser.fPasswordHashHexa);
      return Result;
    };
    this.ClientSessionComputeSignature = function (Sender, url) {
      var Result = "";
      var nonce = "";
      nonce = pas.SysUtils.LowerCase(pas.SysUtils.IntToHex(pas.System.Trunc(pas.SysUtils.Now() * (24 * 60 * 60)),8));
      Result = this.fSessionIDHexa8 + nonce + pas.SysUtils.LowerCase(pas.SysUtils.IntToHex(pas["Web.mORMot.CryptoUtils"].crc32ascii(pas["Web.mORMot.CryptoUtils"].crc32ascii(this.fSessionPrivateKey,nonce),url),8));
      return Result;
    };
  });
  this.TServiceInternalMethod = {"0": "imFree", imFree: 0, "1": "imContract", imContract: 1, "2": "imSignature", imSignature: 2};
  this.SERVICE_PSEUDO_METHOD = ["_free_","_contract_","_signature_"];
});
rtl.module("mORMotPas2JsClient",["System","SysUtils","JS","Web","Types","Web.mORMot.Types","Web.mORMot.Utils","Web.mORMot.OrmTypes","Web.mORMot.AuthTypes","Web.mORMot.RestTypes","Web.mORMot.Rest"],function () {
  "use strict";
  var $mod = this;
  this.TSex = {"0": "cMale", cMale: 0, "1": "cFemale", cFemale: 1};
  rtl.recNewT(this,"TCat",function () {
    this.Name = "";
    this.Sex = 0;
    this.Birthday = 0.0;
    this.$eq = function (b) {
      return (this.Name === b.Name) && (this.Sex === b.Sex) && (this.Birthday === b.Birthday);
    };
    this.$assign = function (s) {
      this.Name = s.Name;
      this.Sex = s.Sex;
      this.Birthday = s.Birthday;
      return this;
    };
  });
  rtl.recNewT(this,"TCatNested1",function () {
    this.Name = "";
    this.Sex = 0;
    this.Birthday = 0.0;
    this.$eq = function (b) {
      return (this.Name === b.Name) && (this.Sex === b.Sex) && (this.Birthday === b.Birthday);
    };
    this.$assign = function (s) {
      this.Name = s.Name;
      this.Sex = s.Sex;
      this.Birthday = s.Birthday;
      return this;
    };
  });
  this.TCat3Array$clone = function (a) {
    var b = [];
    b.length = 3;
    for (var c = 0; c < 3; c++) b[c] = $mod.TCat.$clone(a[c]);
    return b;
  };
  rtl.recNewT(this,"TPeople",function () {
    this.FirstName = "";
    this.LastName = "";
    this.Sex = 0;
    this.Birthday = 0.0;
    this.$new = function () {
      var r = Object.create(this);
      r.Cat = $mod.TCat.$new();
      r.CatNested = $mod.TCatNested1.$new();
      r.Cat3 = rtl.arraySetLength(null,$mod.TCat,3);
      r.Cats = [];
      r.CatsNested = [];
      return r;
    };
    this.$eq = function (b) {
      return (this.FirstName === b.FirstName) && (this.LastName === b.LastName) && (this.Sex === b.Sex) && (this.Birthday === b.Birthday) && this.Cat.$eq(b.Cat) && this.CatNested.$eq(b.CatNested) && rtl.arrayEq(this.Cat3,b.Cat3) && (this.Cats === b.Cats) && (this.CatsNested === b.CatsNested);
    };
    this.$assign = function (s) {
      this.FirstName = s.FirstName;
      this.LastName = s.LastName;
      this.Sex = s.Sex;
      this.Birthday = s.Birthday;
      this.Cat.$assign(s.Cat);
      this.CatNested.$assign(s.CatNested);
      this.Cat3 = $mod.TCat3Array$clone(s.Cat3);
      this.Cats = rtl.arrayRef(s.Cats);
      this.CatsNested = rtl.arrayRef(s.CatsNested);
      return this;
    };
  });
  rtl.createClass(this,"TServiceCalculator",pas["Web.mORMot.Rest"].TServiceClientAbstract,function () {
    this.Create$1 = function (aClient) {
      this.fServiceName = "Calculator";
      this.fServiceURI = "Calculator";
      this.fInstanceImplementation = 1;
      this.fContractExpected = "A788874160C720E1";
      pas["Web.mORMot.Rest"].TServiceClientAbstract.Create$1.call(this,aClient);
      return this;
    };
    this.Add = function (n1, n2, onSuccess, onError) {
      var $Self = this;
      this.fClient.CallRemoteServiceAsynch($Self,"Add",1,[n1,n2],function (res) {
        onSuccess(pas.JS.toInteger(res[0]));
      },onError,false);
    };
    this._Add = function (n1, n2) {
      var Result = 0;
      var res = [];
      res = this.fClient.CallRemoteServiceSynch(this,"Add",1,[n1,n2],false);
      Result = pas.JS.toInteger(res[0]);
      return Result;
    };
    this.ArrayValue = function (arrJSON, ix, onSuccess, onError) {
      var $Self = this;
      this.fClient.CallRemoteServiceAsynch($Self,"ArrayValue",1,[arrJSON,ix],function (res) {
        onSuccess(res[0]);
      },onError,false);
    };
    this._ArrayValue = function (arrJSON, ix) {
      var Result = undefined;
      var res = [];
      res = this.fClient.CallRemoteServiceSynch(this,"ArrayValue",1,[arrJSON,ix],false);
      Result = res[0];
      return Result;
    };
    this.CountArray = function (jsn, onSuccess, onError) {
      var $Self = this;
      this.fClient.CallRemoteServiceAsynch($Self,"CountArray",1,[jsn],function (res) {
        onSuccess(pas.JS.toInteger(res[0]));
      },onError,false);
    };
    this._CountArray = function (jsn) {
      var Result = 0;
      var res = [];
      res = this.fClient.CallRemoteServiceSynch(this,"CountArray",1,[jsn],false);
      Result = pas.JS.toInteger(res[0]);
      return Result;
    };
    this.SumArray = function (jsn, onSuccess, onError) {
      var $Self = this;
      this.fClient.CallRemoteServiceAsynch($Self,"SumArray",1,[jsn],function (res) {
        onSuccess(pas["Web.mORMot.Utils"].toDouble(res[0]));
      },onError,false);
    };
    this._SumArray = function (jsn) {
      var Result = 0.0;
      var res = [];
      res = this.fClient.CallRemoteServiceSynch(this,"SumArray",1,[jsn],false);
      Result = pas["Web.mORMot.Utils"].toDouble(res[0]);
      return Result;
    };
    this.GetPeople = function (aId, aPeople, onSuccess, onError) {
      var $Self = this;
      this.fClient.CallRemoteServiceAsynch($Self,"GetPeople",2,[aId,$mod.TPeople2Variant(aPeople)],function (res) {
        onSuccess($mod.TPeople.$clone($mod.Variant2TPeople(res[0])),pas.JS.toBoolean(res[1]));
      },onError,false);
    };
    this._GetPeople = function (aId, aPeople) {
      var Result = false;
      var res = [];
      res = this.fClient.CallRemoteServiceSynch(this,"GetPeople",2,[aId,$mod.TPeople2Variant(aPeople)],false);
      aPeople.$assign($mod.Variant2TPeople(res[0]));
      Result = pas.JS.toBoolean(res[1]);
      return Result;
    };
    this.AddCat2People = function (aCat, aPeople, onSuccess, onError) {
      var $Self = this;
      this.fClient.CallRemoteServiceAsynch($Self,"AddCat2People",2,[$mod.TCat2Variant(aCat),$mod.TPeople2Variant(aPeople)],function (res) {
        onSuccess($mod.TPeople.$clone($mod.Variant2TPeople(res[0])),pas.JS.toBoolean(res[1]));
      },onError,false);
    };
    this._AddCat2People = function (aCat, aPeople) {
      var Result = false;
      var res = [];
      res = this.fClient.CallRemoteServiceSynch(this,"AddCat2People",2,[$mod.TCat2Variant(aCat),$mod.TPeople2Variant(aPeople)],false);
      aPeople.$assign($mod.Variant2TPeople(res[0]));
      Result = pas.JS.toBoolean(res[1]);
      return Result;
    };
  });
  this.SERVER_PORT = 888;
  this.SERVER_ROOT = "root";
  this.GetModel = function (aRoot) {
    var Result = null;
    Result = pas["Web.mORMot.OrmTypes"].TORMModel.$create("Create$1",[[pas["Web.mORMot.AuthTypes"].TAuthGroup,pas["Web.mORMot.AuthTypes"].TAuthUser],aRoot]);
    return Result;
  };
  this.GetClient = function (aServerAddress, aUserName, aPassword, onSuccess, onError, aServerPort, aServerRoot) {
    var client = null;
    client = pas["Web.mORMot.Rest"].TRestClientHTTP.$create("Create$2",[aServerAddress,aServerPort,$mod.GetModel(aServerRoot),true,false]);
    client.Connect(function (Client) {
      try {
        if (Client.GetServerTimeStamp() === 0) {
          if (onError != null) onError(Client);
          return;
        };
        if (!Client.SetUser(pas["Web.mORMot.Rest"].TRestServerAuthenticationDefault,aUserName,aPassword,false)) {
          if (onError != null) onError(Client);
          return;
        };
        if (onSuccess != null) onSuccess(Client);
      } catch ($e) {
        if (onError != null) onError(Client);
      };
    },onError);
  };
  this.Variant2TSex = function (_variant) {
    var Result = 0;
    Result = _variant;
    return Result;
  };
  this.Variant2TCat = function (Value) {
    var Result = $mod.TCat.$new();
    Result.Name = pas["Web.mORMot.Utils"].toRawUtf8(Value["Name"]);
    Result.Sex = $mod.Variant2TSex(Value["Sex"]);
    Result.Birthday = pas["Web.mORMot.Utils"].Iso8601ToDateTime(Value["Birthday"]);
    return Result;
  };
  this.TCat2Variant = function (Value) {
    var Result = undefined;
    var rec = null;
    rec = new Object();
    rec["Name"] = Value.Name;
    rec["Sex"] = Value.Sex;
    rec["Birthday"] = pas["Web.mORMot.Utils"].DateTimeToIso8601(Value.Birthday);
    Result = rec;
    return Result;
  };
  this.Variant2TCatNested1 = function (Value) {
    var Result = $mod.TCatNested1.$new();
    Result.Name = pas["Web.mORMot.Utils"].toRawUtf8(Value["Name"]);
    Result.Sex = $mod.Variant2TSex(Value["Sex"]);
    Result.Birthday = pas["Web.mORMot.Utils"].Iso8601ToDateTime(Value["Birthday"]);
    return Result;
  };
  this.TCatNested12Variant = function (Value) {
    var Result = undefined;
    var rec = null;
    rec = new Object();
    rec["Name"] = Value.Name;
    rec["Sex"] = Value.Sex;
    rec["Birthday"] = pas["Web.mORMot.Utils"].DateTimeToIso8601(Value.Birthday);
    Result = rec;
    return Result;
  };
  this.Variant2TPeople = function (Value) {
    var Result = $mod.TPeople.$new();
    Result.FirstName = pas["Web.mORMot.Utils"].toRawUtf8(Value["FirstName"]);
    Result.LastName = pas["Web.mORMot.Utils"].toRawUtf8(Value["LastName"]);
    Result.Sex = $mod.Variant2TSex(Value["Sex"]);
    Result.Birthday = pas["Web.mORMot.Utils"].Iso8601ToDateTime(Value["Birthday"]);
    Result.Cat.$assign($mod.Variant2TCat(Value["Cat"]));
    Result.CatNested.$assign($mod.Variant2TCatNested1(Value["CatNested"]));
    Result.Cat3 = $mod.Variant2TCat3Array(Value["Cat3"]);
    Result.Cats = $mod.Variant2TCatDynArray(Value["Cats"]);
    Result.CatsNested = $mod.Variant2TCatsNested2(Value["CatsNested"]);
    return Result;
  };
  this.TPeople2Variant = function (Value) {
    var Result = undefined;
    var rec = null;
    rec = new Object();
    rec["FirstName"] = Value.FirstName;
    rec["LastName"] = Value.LastName;
    rec["Sex"] = Value.Sex;
    rec["Birthday"] = pas["Web.mORMot.Utils"].DateTimeToIso8601(Value.Birthday);
    rec["Cat"] = $mod.TCat2Variant(Value.Cat);
    rec["CatNested"] = $mod.TCatNested12Variant(Value.CatNested);
    rec["Cat3"] = $mod.TCat3Array2Variant(Value.Cat3);
    rec["Cats"] = $mod.TCatDynArray2Variant(Value.Cats);
    rec["CatsNested"] = $mod.TCatsNested22Variant(Value.CatsNested);
    Result = rec;
    return Result;
  };
  this.Variant2TCat3Array = function (_variant) {
    var Result = rtl.arraySetLength(null,$mod.TCat,3);
    var tmp = $mod.TCat.$new();
    var i = 0;
    if (rtl.isArray(_variant)) {
      for (var $l = 0, $end = _variant.length - 1; $l <= $end; $l++) {
        i = $l;
        tmp.$assign($mod.Variant2TCat(_variant[i]));
        Result[i].$assign(tmp);
      };
    };
    return Result;
  };
  this.TCat3Array2Variant = function (_array) {
    var Result = undefined;
    var i = 0;
    Result = new Array();
    for (i = 0; i <= 2; i++) Result.push($mod.TCat2Variant(_array[i]));
    return Result;
  };
  this.Variant2TCatDynArray = function (_variant) {
    var Result = [];
    var tmp = $mod.TCat.$new();
    var i = 0;
    if (rtl.isArray(_variant)) {
      Result = rtl.arraySetLength(Result,$mod.TCat,_variant.length);
      for (var $l = 0, $end = _variant.length - 1; $l <= $end; $l++) {
        i = $l;
        tmp.$assign($mod.Variant2TCat(_variant[i]));
        Result[i].$assign(tmp);
      };
    };
    return Result;
  };
  this.TCatDynArray2Variant = function (_array) {
    var Result = undefined;
    var i = 0;
    Result = new Array();
    for (var $l = 0, $end = rtl.length(_array) - 1; $l <= $end; $l++) {
      i = $l;
      Result.push($mod.TCat2Variant(_array[i]));
    };
    return Result;
  };
  this.Variant2TCatsNested2 = function (_variant) {
    var Result = [];
    var tmp = $mod.TCat.$new();
    var i = 0;
    if (rtl.isArray(_variant)) {
      Result = rtl.arraySetLength(Result,$mod.TCat,_variant.length);
      for (var $l = 0, $end = _variant.length - 1; $l <= $end; $l++) {
        i = $l;
        tmp.$assign($mod.Variant2TCat(_variant[i]));
        Result[i].$assign(tmp);
      };
    };
    return Result;
  };
  this.TCatsNested22Variant = function (_array) {
    var Result = undefined;
    var i = 0;
    Result = new Array();
    for (var $l = 0, $end = rtl.length(_array) - 1; $l <= $end; $l++) {
      i = $l;
      Result.push($mod.TCat2Variant(_array[i]));
    };
    return Result;
  };
});
rtl.module("calculator",["System","Classes","SysUtils","JS","Web","Types","Web.mORMot.Types","Web.mORMot.Rest","mORMotPas2JsClient"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TCalculatorView",pas.Classes.TComponent,function () {
    this.$init = function () {
      pas.Classes.TComponent.$init.call(this);
      this.calc_add_x = null;
      this.calc_add_y = null;
      this.calc_add_btnsync = null;
      this.calc_add_btnasync = null;
      this.calc_add_res = null;
      this.calc_arrval_arr = null;
      this.calc_arrval_index = null;
      this.calc_arrval_btnsync = null;
      this.calc_arrval_btnasync = null;
      this.calc_arrval_res = null;
      this.calc_cntarr_arr = null;
      this.calc_cntarr_btnsync = null;
      this.calc_cntarr_btnasync = null;
      this.calc_cntarr_res = null;
      this.calc_sumarr_arr = null;
      this.calc_sumarr_btnsync = null;
      this.calc_sumarr_btnasync = null;
      this.calc_sumarr_res = null;
    };
    this.$final = function () {
      this.calc_add_x = undefined;
      this.calc_add_y = undefined;
      this.calc_add_btnsync = undefined;
      this.calc_add_btnasync = undefined;
      this.calc_add_res = undefined;
      this.calc_arrval_arr = undefined;
      this.calc_arrval_index = undefined;
      this.calc_arrval_btnsync = undefined;
      this.calc_arrval_btnasync = undefined;
      this.calc_arrval_res = undefined;
      this.calc_cntarr_arr = undefined;
      this.calc_cntarr_btnsync = undefined;
      this.calc_cntarr_btnasync = undefined;
      this.calc_cntarr_res = undefined;
      this.calc_sumarr_arr = undefined;
      this.calc_sumarr_btnsync = undefined;
      this.calc_sumarr_btnasync = undefined;
      this.calc_sumarr_res = undefined;
      pas.Classes.TComponent.$final.call(this);
    };
    this.AddSyncOnClick = function (Event) {
      var Result = false;
      var z = 0;
      z = pas.main.MainForm.Calc._Add(pas.SysUtils.StrToInt(this.calc_add_x.value),pas.SysUtils.StrToInt(this.calc_add_y.value));
      this.calc_add_res.innerText = pas.SysUtils.IntToStr(z);
      return Result;
    };
    this.AddAsyncOnClick = function (Event) {
      var $Self = this;
      var Result = false;
      pas.main.MainForm.Calc.Add(pas.SysUtils.StrToInt(this.calc_add_x.value),pas.SysUtils.StrToInt(this.calc_add_y.value),function (res) {
        $Self.calc_add_res.innerText = pas.SysUtils.IntToStr(res);
      },function (Client) {
        window.console.log("Error calling the Add method");
      });
      return Result;
    };
    this.ArrValSyncOnClick = function (Event) {
      var Result = false;
      var val = undefined;
      val = pas.main.MainForm.Calc._ArrayValue(this.calc_arrval_arr.value,pas.SysUtils.StrToInt(this.calc_arrval_index.value));
      this.calc_arrval_res.innerText = "" + val;
      return Result;
    };
    this.ArrValAsyncOnClick = function (Event) {
      var $Self = this;
      var Result = false;
      pas.main.MainForm.Calc.ArrayValue(this.calc_arrval_arr.value,pas.SysUtils.StrToInt(this.calc_arrval_index.value),function (res) {
        $Self.calc_arrval_res.innerText = "" + res;
      },function (Client) {
        window.console.log("Error calling the Async ArrayValue method");
      });
      return Result;
    };
    this.CntArrSyncOnClick = function (Event) {
      var Result = false;
      var rec = $mod.TArrayRec.$new();
      var jsn = "";
      var res = 0;
      rec.VarArr = JSON.parse(this.calc_cntarr_arr.value);
      jsn = JSON.stringify($mod.TArrayRec.$clone(rec));
      res = pas.main.MainForm.Calc._CountArray(jsn);
      this.calc_cntarr_res.innerText = pas.SysUtils.IntToStr(res);
      return Result;
    };
    this.CntArrAsyncOnClick = function (Event) {
      var $Self = this;
      var Result = false;
      var rec = $mod.TArrayRec.$new();
      var jsn = "";
      rec.VarArr = JSON.parse(this.calc_cntarr_arr.value);
      jsn = JSON.stringify($mod.TArrayRec.$clone(rec));
      pas.main.MainForm.Calc.CountArray(jsn,function (res) {
        $Self.calc_cntarr_res.innerText = pas.SysUtils.IntToStr(res);
      },function (Client) {
        window.console.log("Error calling the CountArray method");
      });
      return Result;
    };
    this.SumArrSyncOnClick = function (Event) {
      var Result = false;
      var rec = $mod.TArrayRec.$new();
      var jsn = "";
      var res = 0.0;
      rec.Arr = JSON.parse(this.calc_sumarr_arr.value);
      jsn = JSON.stringify($mod.TArrayRec.$clone(rec));
      res = pas.main.MainForm.Calc._SumArray(jsn);
      this.calc_sumarr_res.innerText = pas.SysUtils.FloatToStr(res);
      return Result;
    };
    this.SumArrAsyncOnClick = function (Event) {
      var $Self = this;
      var Result = false;
      var rec = $mod.TArrayRec.$new();
      var jsn = "";
      rec.Arr = JSON.parse(this.calc_sumarr_arr.value);
      jsn = JSON.stringify($mod.TArrayRec.$clone(rec));
      pas.main.MainForm.Calc.SumArray(jsn,function (res) {
        $Self.calc_sumarr_res.innerText = pas.SysUtils.FloatToStr(res);
      },function (Client) {
        window.console.log("Error calling the SumArray method");
      });
      return Result;
    };
    this.Create$1 = function (aOwner) {
      pas.Classes.TComponent.Create$1.apply(this,arguments);
      this.BindElements();
      return this;
    };
    this.BindElements = function () {
      this.calc_add_x = document.getElementById("calc-add-x");
      this.calc_add_y = document.getElementById("calc-add-y");
      this.calc_add_btnsync = document.getElementById("calc-add-btnsync");
      this.calc_add_btnasync = document.getElementById("calc-add-btnasync");
      this.calc_add_res = document.getElementById("calc-add-res");
      this.calc_arrval_arr = document.getElementById("calc-arrval-arr");
      this.calc_arrval_index = document.getElementById("calc-arrval-index");
      this.calc_arrval_btnsync = document.getElementById("calc-arrval-btnsync");
      this.calc_arrval_btnasync = document.getElementById("calc-arrval-btnasync");
      this.calc_arrval_res = document.getElementById("calc-arrval-res");
      this.calc_cntarr_arr = document.getElementById("calc-cntarr-arr");
      this.calc_cntarr_btnsync = document.getElementById("calc-cntarr-btnsync");
      this.calc_cntarr_btnasync = document.getElementById("calc-cntarr-btnasync");
      this.calc_cntarr_res = document.getElementById("calc-cntarr-res");
      this.calc_sumarr_arr = document.getElementById("calc-sumarr-arr");
      this.calc_sumarr_btnsync = document.getElementById("calc-sumarr-btnsync");
      this.calc_sumarr_btnasync = document.getElementById("calc-sumarr-btnasync");
      this.calc_sumarr_res = document.getElementById("calc-sumarr-res");
      this.calc_add_btnsync.onclick = rtl.createSafeCallback(this,"AddSyncOnClick");
      this.calc_add_btnasync.onclick = rtl.createSafeCallback(this,"AddAsyncOnClick");
      this.calc_arrval_btnsync.onclick = rtl.createSafeCallback(this,"ArrValSyncOnClick");
      this.calc_arrval_btnasync.onclick = rtl.createSafeCallback(this,"ArrValAsyncOnClick");
      this.calc_cntarr_btnsync.onclick = rtl.createSafeCallback(this,"CntArrSyncOnClick");
      this.calc_cntarr_btnasync.onclick = rtl.createSafeCallback(this,"CntArrAsyncOnClick");
      this.calc_sumarr_btnsync.onclick = rtl.createSafeCallback(this,"SumArrSyncOnClick");
      this.calc_sumarr_btnasync.onclick = rtl.createSafeCallback(this,"SumArrAsyncOnClick");
    };
    var $r = this.$rtti;
    $r.addMethod("Create$1",2,[["aOwner",pas.Classes.$rtti["TComponent"]]]);
  });
  rtl.recNewT(this,"TArrayRec",function () {
    this.$new = function () {
      var r = Object.create(this);
      r.Arr = [];
      r.VarArr = [];
      return r;
    };
    this.$eq = function (b) {
      return (this.Arr === b.Arr) && (this.VarArr === b.VarArr);
    };
    this.$assign = function (s) {
      this.Arr = rtl.arrayRef(s.Arr);
      this.VarArr = rtl.arrayRef(s.VarArr);
      return this;
    };
  });
},["main"]);
rtl.module("people",["System","Classes","SysUtils","JS","Web","Types","Web.mORMot.Types","Web.mORMot.Rest","mORMotPas2JsClient"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TPeopleView",pas.Classes.TComponent,function () {
    this.$init = function () {
      pas.Classes.TComponent.$init.call(this);
      this.ppl_get_id = null;
      this.ppl_get_btnsync = null;
      this.ppl_get_btnasync = null;
      this.ppl_form_addcat = null;
      this.ppl_c2p_name = null;
      this.ppl_c2p_birth = null;
      this.ppl_c2p_male = null;
      this.ppl_c2p_female = null;
      this.ppl_c2p_btnsync = null;
      this.ppl_c2p_btnasync = null;
      this.ppl_card = null;
      this.ppl_firstname = null;
      this.ppl_lastname = null;
      this.ppl_birthday = null;
      this.ppl_sex = null;
      this.ppl_cat_name = null;
      this.ppl_cat_birth = null;
      this.ppl_cat_sex = null;
      this.ppl_cats = null;
      this.fPeople = pas.mORMotPas2JsClient.TPeople.$new();
    };
    this.$final = function () {
      this.ppl_get_id = undefined;
      this.ppl_get_btnsync = undefined;
      this.ppl_get_btnasync = undefined;
      this.ppl_form_addcat = undefined;
      this.ppl_c2p_name = undefined;
      this.ppl_c2p_birth = undefined;
      this.ppl_c2p_male = undefined;
      this.ppl_c2p_female = undefined;
      this.ppl_c2p_btnsync = undefined;
      this.ppl_c2p_btnasync = undefined;
      this.ppl_card = undefined;
      this.ppl_firstname = undefined;
      this.ppl_lastname = undefined;
      this.ppl_birthday = undefined;
      this.ppl_sex = undefined;
      this.ppl_cat_name = undefined;
      this.ppl_cat_birth = undefined;
      this.ppl_cat_sex = undefined;
      this.ppl_cats = undefined;
      this.fPeople = undefined;
      pas.Classes.TComponent.$final.call(this);
    };
    this.TSex2String = function (Value) {
      var Result = "";
      if (Value === 0) {
        Result = "Male"}
       else Result = "Female";
      return Result;
    };
    this.GetPeopleSyncOnClick = function (Event) {
      var Result = false;
      if (pas.main.MainForm.Calc._GetPeople(pas.SysUtils.StrToInt(this.ppl_get_id.value),this.fPeople)) this.ShowPeople();
      return Result;
    };
    this.GetPeopleAsyncOnClick = function (Event) {
      var $Self = this;
      var Result = false;
      pas.main.MainForm.Calc.GetPeople(pas.SysUtils.StrToInt(this.ppl_get_id.value),this.fPeople,function (aPeople, aResult) {
        if (aResult) {
          $Self.fPeople.$assign(aPeople);
          $Self.ShowPeople();
        };
      },function (Client) {
        window.console.log("Error calling the GetPeople method");
      });
      return Result;
    };
    this.AddCat2PeopleSyncOnClick = function (Event) {
      var Result = false;
      var pCat = pas.mORMotPas2JsClient.TCat.$new();
      pCat.Name = this.ppl_c2p_name.value;
      pCat.Birthday = pas.SysUtils.StrToDate(this.ppl_c2p_birth.value);
      if (this.ppl_c2p_male.checked) {
        pCat.Sex = 0}
       else pCat.Sex = 1;
      if (pas.main.MainForm.Calc._AddCat2People(pCat,this.fPeople)) this.ShowPeople();
      return Result;
    };
    this.AddCat2PeopleAsyncOnClick = function (Event) {
      var $Self = this;
      var Result = false;
      var pCat = pas.mORMotPas2JsClient.TCat.$new();
      pCat.Name = this.ppl_c2p_name.value;
      pCat.Birthday = pas.SysUtils.StrToDate(this.ppl_c2p_birth.value);
      if (this.ppl_c2p_male.checked) {
        pCat.Sex = 0}
       else pCat.Sex = 1;
      pas.main.MainForm.Calc.AddCat2People(pCat,this.fPeople,function (aPeople, aResult) {
        if (aResult) {
          $Self.fPeople.$assign(aPeople);
          $Self.ShowPeople();
        };
      },function (Client) {
        window.console.log("Error calling the AddCat2People method");
      });
      return Result;
    };
    this.Create$1 = function (aOwner) {
      pas.Classes.TComponent.Create$1.apply(this,arguments);
      this.BindElements();
      return this;
    };
    this.BindElements = function () {
      this.ppl_get_id = document.getElementById("ppl-get-id");
      this.ppl_get_btnsync = document.getElementById("ppl-get-btnsync");
      this.ppl_get_btnasync = document.getElementById("ppl-get-btnasync");
      this.ppl_form_addcat = document.getElementById("ppl-form-addcat");
      this.ppl_c2p_name = document.getElementById("ppl-c2p-name");
      this.ppl_c2p_birth = document.getElementById("ppl-c2p-birth");
      this.ppl_c2p_male = document.getElementById("ppl-c2p-male");
      this.ppl_c2p_female = document.getElementById("ppl-c2p-female");
      this.ppl_c2p_btnsync = document.getElementById("ppl-c2p-btnsync");
      this.ppl_c2p_btnasync = document.getElementById("ppl-c2p-btnasync");
      this.ppl_card = document.getElementById("ppl-card");
      this.ppl_firstname = document.getElementById("ppl-firstname");
      this.ppl_lastname = document.getElementById("ppl-lastname");
      this.ppl_birthday = document.getElementById("ppl-birthday");
      this.ppl_sex = document.getElementById("ppl-sex");
      this.ppl_cat_name = document.getElementById("ppl-cat-name");
      this.ppl_cat_birth = document.getElementById("ppl-cat-birth");
      this.ppl_cat_sex = document.getElementById("ppl-cat-sex");
      this.ppl_cats = document.getElementById("ppl-cats");
      this.ppl_get_btnsync.onclick = rtl.createSafeCallback(this,"GetPeopleSyncOnClick");
      this.ppl_get_btnasync.onclick = rtl.createSafeCallback(this,"GetPeopleAsyncOnClick");
      this.ppl_c2p_btnsync.onclick = rtl.createSafeCallback(this,"AddCat2PeopleSyncOnClick");
      this.ppl_c2p_btnasync.onclick = rtl.createSafeCallback(this,"AddCat2PeopleAsyncOnClick");
      this.ShowPeople();
    };
    this.ClearPeople = function () {
      this.fPeople.FirstName = "";
      this.fPeople.LastName = "";
      this.fPeople.Birthday = 0;
      this.fPeople.Cats = rtl.arraySetLength(this.fPeople.Cats,pas.mORMotPas2JsClient.TCat,0);
    };
    this.ShowPeople = function () {
      var c = pas.mORMotPas2JsClient.TCat.$new();
      var pCard = null;
      var pFs = null;
      var pLb = null;
      var pIn = null;
      if (this.fPeople.FirstName === "") {
        this.ppl_form_addcat.setAttribute("hidden","");
        this.ppl_card.setAttribute("hidden","");
        return;
      };
      this.ppl_firstname.value = this.fPeople.FirstName;
      this.ppl_lastname.value = this.fPeople.LastName;
      this.ppl_birthday.value = pas.SysUtils.DateToStr(this.fPeople.Birthday);
      this.ppl_sex.innerText = this.TSex2String(this.fPeople.Sex);
      this.ppl_cat_name.value = this.fPeople.Cat.Name;
      this.ppl_cat_birth.value = pas.SysUtils.DateToStr(this.fPeople.Cat.Birthday);
      this.ppl_cat_sex.innerText = this.TSex2String(this.fPeople.Cat.Sex);
      this.ppl_cats.innerHTML = "";
      for (var $in = this.fPeople.Cats, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        c = $in[$l];
        pCard = document.createElement("article");
        pFs = document.createElement("fieldset");
        pFs.setAttribute("class","grid");
        pCard.append(pFs);
        pLb = document.createElement("label");
        pLb.innerText = "Name";
        pIn = document.createElement("input");
        pIn.setAttribute("value",c.Name);
        pLb.append(pIn);
        pFs.append(pLb);
        pLb = document.createElement("label");
        pLb.innerText = "Birthday";
        pIn = document.createElement("input");
        pIn.setAttribute("value",pas.SysUtils.DateToStr(c.Birthday));
        pLb.append(pIn);
        pFs.append(pLb);
        pLb = document.createElement("label");
        pLb.innerText = "Sex";
        pIn = document.createElement("div");
        pIn.innerText = this.TSex2String(c.Sex);
        pLb.append(pIn);
        pFs.append(pLb);
        this.ppl_cats.append(pCard);
      };
      this.ppl_form_addcat.removeAttribute("hidden");
      this.ppl_card.removeAttribute("hidden");
    };
    var $r = this.$rtti;
    $r.addMethod("Create$1",2,[["aOwner",pas.Classes.$rtti["TComponent"]]]);
  });
},["main"]);
rtl.module("main",["System","JS","Web","Classes","login","calculator","people","Web.mORMot.Types","Web.mORMot.Rest","Web.mORMot.RestTypes","mORMotPas2JsClient"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TMainForm",pas.Classes.TComponent,function () {
    this.$init = function () {
      pas.Classes.TComponent.$init.call(this);
      this.menu_calculator = null;
      this.menu_people = null;
      this.menu_logout = null;
      this.view_calc = null;
      this.view_people = null;
      this.fClient = null;
      this.fLoginView = null;
      this.fCalculatorView = null;
      this.fPeopleView = null;
      this.Calc = null;
    };
    this.$final = function () {
      this.menu_calculator = undefined;
      this.menu_people = undefined;
      this.menu_logout = undefined;
      this.view_calc = undefined;
      this.view_people = undefined;
      this.fClient = undefined;
      this.fLoginView = undefined;
      this.fCalculatorView = undefined;
      this.fPeopleView = undefined;
      this.Calc = undefined;
      pas.Classes.TComponent.$final.call(this);
    };
    this.CalculatorOnClick = function (Event) {
      var Result = false;
      this.view_calc.removeAttribute("Hidden");
      this.view_people.setAttribute("Hidden","");
      return Result;
    };
    this.PeopleOnClick = function (Event) {
      var Result = false;
      this.view_calc.setAttribute("Hidden","");
      this.view_people.removeAttribute("Hidden");
      this.fPeopleView.ShowPeople();
      return Result;
    };
    this.LogoutOnClick = function (Event) {
      var Result = false;
      rtl.free(this,"Calc");
      this.fClient.SessionClose();
      rtl.free(this,"fClient");
      this.fClient = null;
      this.fPeopleView.ClearPeople();
      this.fLoginView.Show();
      return Result;
    };
    this.Create$1 = function (aOwner) {
      pas.Classes.TComponent.Create$1.apply(this,arguments);
      this.BindElements();
      this.fLoginView = pas.login.TLoginView.$create("Create$1",[this]);
      this.fCalculatorView = pas.calculator.TCalculatorView.$create("Create$1",[this]);
      this.fPeopleView = pas.people.TPeopleView.$create("Create$1",[this]);
      return this;
    };
    this.BindElements = function () {
      this.menu_calculator = document.getElementById("menu-calculator");
      this.menu_people = document.getElementById("menu-people");
      this.menu_logout = document.getElementById("menu-logout");
      this.view_calc = document.getElementById("view-calc");
      this.view_people = document.getElementById("view-people");
      this.menu_calculator.onclick = rtl.createSafeCallback(this,"CalculatorOnClick");
      this.menu_people.onclick = rtl.createSafeCallback(this,"PeopleOnClick");
      this.menu_logout.onclick = rtl.createSafeCallback(this,"LogoutOnClick");
    };
    this.Login = function (aUser, aPassword) {
      var $Self = this;
      pas.mORMotPas2JsClient.GetClient("127.0.0.1",aUser,aPassword,function (aClient) {
        window.console.log("Connected");
        $Self.fClient = aClient;
        $Self.Calc = pas.mORMotPas2JsClient.TServiceCalculator.$create("Create$1",[$Self.fClient]);
        $Self.fLoginView.Hide();
        $Self.view_calc.removeAttribute("Hidden");
        $Self.view_people.setAttribute("Hidden","");
      },function (aClient) {
        $Self.fLoginView.SmallMessage("Unable to connect to server");
      },888,pas.mORMotPas2JsClient.SERVER_ROOT);
    };
    var $r = this.$rtti;
    $r.addMethod("Create$1",2,[["aOwner",pas.Classes.$rtti["TComponent"]]]);
  });
  this.MainForm = null;
});
rtl.module("program",["System","BrowserApp","JS","Classes","SysUtils","Web","main","calculator","people"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TMyApplication",pas.BrowserApp.TBrowserApplication,function () {
    this.DoRun = function () {
      pas.main.MainForm = pas.main.TMainForm.$create("Create$1",[this]);
    };
  });
  this.Application = null;
  $mod.$main = function () {
    $mod.Application = $mod.TMyApplication.$create("Create$1",[null]);
    $mod.Application.Initialize();
    $mod.Application.Run();
  };
});
//# sourceMappingURL=mormotcalcpas2js.js.map
