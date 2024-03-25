unit calculator;

{$mode ObjFPC}

interface

uses Classes, SysUtils,
  js, web, Types,
  Web.mORMot.Types,
  Web.mORMot.Rest,
  mORMotPas2JsClient;

type

  { TCalculatorView }

  TCalculatorView = class(TComponent)
  private
    calc_add_x : TJSHTMLInputElement;
    calc_add_y : TJSHTMLInputElement;
    calc_add_btnsync : TJSHTMLButtonElement;
    calc_add_btnasync : TJSHTMLButtonElement;
    calc_add_res : TJSHTMLElement;
    calc_arrval_arr : TJSHTMLInputElement;
    calc_arrval_index : TJSHTMLInputElement;
    calc_arrval_btnsync : TJSHTMLButtonElement;
    calc_arrval_btnasync : TJSHTMLButtonElement;
    calc_arrval_res : TJSHTMLElement;
    calc_cntarr_arr : TJSHTMLInputElement;
    calc_cntarr_btnsync : TJSHTMLButtonElement;
    calc_cntarr_btnasync : TJSHTMLButtonElement;
    calc_cntarr_res : TJSHTMLElement;
    calc_sumarr_arr : TJSHTMLInputElement;
    calc_sumarr_btnsync : TJSHTMLButtonElement;
    calc_sumarr_btnasync : TJSHTMLButtonElement;
    calc_sumarr_res : TJSHTMLElement;
  private
    function AddSyncOnClick(Event: TJSMouseEvent): boolean;
    function AddAsyncOnClick(Event: TJSMouseEvent): boolean;
    function ArrValSyncOnClick(Event: TJSMouseEvent): boolean;
    function ArrValAsyncOnClick(Event: TJSMouseEvent): boolean;
    function CntArrSyncOnClick(Event: TJSMouseEvent): boolean;
    function CntArrAsyncOnClick(Event: TJSMouseEvent): boolean;
    function SumArrSyncOnClick(Event: TJSMouseEvent): boolean;
    function SumArrAsyncOnClick(Event: TJSMouseEvent): boolean;
  Public
    constructor Create(aOwner : TComponent); override;
    Procedure BindElements; virtual;
  end;

  TArrayRec = packed record
    Arr: TDoubleDynArray;
    VarArr: TJSValueDynArray;
  end;

implementation

uses main;

{ TCalculatorView }

function TCalculatorView.AddSyncOnClick(Event: TJSMouseEvent): boolean;
var
  z: integer;
begin
  z := MainForm.Calc._Add(StrToInt(calc_add_x.value), StrToInt(calc_add_y.value));
  calc_add_res.innerText:=IntToStr(z);
end;

function TCalculatorView.AddAsyncOnClick(Event: TJSMouseEvent): boolean;
begin
  MainForm.Calc.Add(StrToInt(calc_add_x.value), StrToInt(calc_add_y.value),
    procedure(res: integer)
    begin
      calc_add_res.innerText:=IntToStr(res);
    end,
    procedure(Client: TRestClientURI)
    begin
      console.log('Error calling the Add method');
    end);
end;

function TCalculatorView.ArrValSyncOnClick(Event: TJSMouseEvent): boolean;
var
  val: JSValue;
begin
  val := MainForm.Calc._ArrayValue(calc_arrval_arr.value, StrToInt(calc_arrval_index.value));
  calc_arrval_res.innerText:=String(val);
end;

function TCalculatorView.ArrValAsyncOnClick(Event: TJSMouseEvent): boolean;
begin
  MainForm.Calc.ArrayValue(
    calc_arrval_arr.value, StrToInt(calc_arrval_index.value),
    procedure(res: JSValue)
    begin
      calc_arrval_res.innerText:=String(res);
    end,
    procedure(Client: TRestClientURI)
    begin
      console.log('Error calling the Async ArrayValue method');
    end);
end;

function TCalculatorView.CntArrSyncOnClick(Event: TJSMouseEvent): boolean;
var
  rec: TArrayRec;
  jsn: string;
  res: integer;
begin
  rec.VarArr := TJSValueDynArray(TJSJSON.parse(calc_cntarr_arr.value));
  jsn := TJSJSON.stringify(rec);
  res := MainForm.Calc._CountArray(jsn);
  calc_cntarr_res.innerText:=IntToStr(res);
end;

function TCalculatorView.CntArrAsyncOnClick(Event: TJSMouseEvent): boolean;
var
  rec: TArrayRec;
  jsn: string;
begin
  rec.VarArr := TJSValueDynArray(TJSJSON.parse(calc_cntarr_arr.value));
  jsn := TJSJSON.stringify(rec);
  MainForm.Calc.CountArray(jsn,
    procedure(res: integer)
    begin
      calc_cntarr_res.innerText:=IntToStr(res);
    end,
    procedure(Client: TRestClientURI)
    begin
      console.log('Error calling the CountArray method');
    end);
end;

function TCalculatorView.SumArrSyncOnClick(Event: TJSMouseEvent): boolean;
var
  rec: TArrayRec;
  jsn: string;
  res: Double;
begin
  rec.Arr := TDoubleDynArray(TJSJSON.parse(calc_sumarr_arr.value));
  jsn := TJSJSON.stringify(rec);
  res := MainForm.Calc._SumArray(jsn);
  calc_sumarr_res.innerText:=FloatToStr(res);
end;

function TCalculatorView.SumArrAsyncOnClick(Event: TJSMouseEvent): boolean;
var
  rec: TArrayRec;
  jsn: string;
begin
  rec.Arr := TDoubleDynArray(TJSJSON.parse(calc_sumarr_arr.value));
  jsn := TJSJSON.stringify(rec);
  MainForm.Calc.SumArray(jsn,
    procedure(res: Double)
    begin
      calc_sumarr_res.innerText:=FloatToStr(res);
    end,
    procedure(Client: TRestClientURI)
    begin
      console.log('Error calling the SumArray method');
    end);
end;

constructor TCalculatorView.Create(aOwner: TComponent);
begin
  inherited;
  BindElements;
end;

procedure TCalculatorView.BindElements;
begin
  calc_add_x:=TJSHTMLInputElement(document.getelementByID('calc-add-x'));
  calc_add_y:=TJSHTMLInputElement(document.getelementByID('calc-add-y'));
  calc_add_btnsync:=TJSHTMLButtonElement(document.getelementByID('calc-add-btnsync'));
  calc_add_btnasync:=TJSHTMLButtonElement(document.getelementByID('calc-add-btnasync'));
  calc_add_res:=TJSHTMLElement(document.getelementByID('calc-add-res'));
  calc_arrval_arr:=TJSHTMLInputElement(document.getelementByID('calc-arrval-arr'));
  calc_arrval_index:=TJSHTMLInputElement(document.getelementByID('calc-arrval-index'));
  calc_arrval_btnsync:=TJSHTMLButtonElement(document.getelementByID('calc-arrval-btnsync'));
  calc_arrval_btnasync:=TJSHTMLButtonElement(document.getelementByID('calc-arrval-btnasync'));
  calc_arrval_res:=TJSHTMLElement(document.getelementByID('calc-arrval-res'));
  calc_cntarr_arr:=TJSHTMLInputElement(document.getelementByID('calc-cntarr-arr'));
  calc_cntarr_btnsync:=TJSHTMLButtonElement(document.getelementByID('calc-cntarr-btnsync'));
  calc_cntarr_btnasync:=TJSHTMLButtonElement(document.getelementByID('calc-cntarr-btnasync'));
  calc_cntarr_res:=TJSHTMLElement(document.getelementByID('calc-cntarr-res'));
  calc_sumarr_arr:=TJSHTMLInputElement(document.getelementByID('calc-sumarr-arr'));
  calc_sumarr_btnsync:=TJSHTMLButtonElement(document.getelementByID('calc-sumarr-btnsync'));
  calc_sumarr_btnasync:=TJSHTMLButtonElement(document.getelementByID('calc-sumarr-btnasync'));
  calc_sumarr_res:=TJSHTMLElement(document.getelementByID('calc-sumarr-res'));

  calc_add_btnsync.onclick:=@AddSyncOnClick;
  calc_add_btnasync.onclick:=@AddAsyncOnClick;

  calc_arrval_btnsync.onclick:=@ArrValSyncOnClick;
  calc_arrval_btnasync.onclick:=@ArrValAsyncOnClick;

  calc_cntarr_btnsync.onclick:=@CntArrSyncOnClick;
  calc_cntarr_btnasync.onclick:=@CntArrAsyncOnClick;

  calc_sumarr_btnsync.onclick:=@SumArrSyncOnClick;
  calc_sumarr_btnasync.onclick:=@SumArrAsyncOnClick;
end;

end.

