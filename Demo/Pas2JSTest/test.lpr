program test;

{$mode objfpc}

uses
  BrowserApp, JS, Classes, SysUtils, Web, Types,
  DateUtils,
  Web.mORMot.Types,
  Web.mORMot.Rest,
  Web.mORMot.RestTypes,
  mORMotPas2JsClient;

type

  { TMyApplication }

  TMyApplication = class(TBrowserApplication)
  protected
    Client: TRestClientURI;
    Calc: TServiceCalculator;
    procedure Connect;

    procedure TestAll;

    procedure TestAdd;
    procedure TestArrayValue;
    procedure TestCountArray;
    procedure TestSumArray;
    procedure TestFullName;
    procedure TestCat;
    procedure TestPeople;

    procedure AddDivText(const aValue: string);
  protected
    procedure DoRun; override;
  public
  end;

  TArrayRec = packed record
    Arr: TDoubleDynArray;
    VarArr: TJSValueDynArray;
  end;


procedure TMyApplication.Connect;
var
  userName: string;
  password: string;
begin
  username:='User';
  password:='synopse';
  if Client = nil then
    // -- GetClient is defined in mORMotClient.pas
    GetClient('127.0.0.1', userName, password,
      procedure(aClient: TRestClientURI)
      begin
        console.log('Connected');
        Client := aClient;
        Calc := TServiceCalculator.Create(Client);

        TestAll;
      end,
      procedure(aClient: TRestClientURI)
      begin
        console.log('Unable to connect to server');
      end)
  else
  begin
    console.log('Already connected');
  end;
end;

procedure TMyApplication.TestAll;
begin
//  TestAdd;
//  TestArrayValue;
//  TestCountArray;
//  TestSumArray;
//  TestFullName;
//  TestCat;
  TestPeople;
end;

procedure TMyApplication.TestCountArray;
var
  rec: TArrayRec;
  jsn: RawUTF8;
  res: integer;
begin
  if Calc=nil then exit;
  SetLength(rec.VarArr, 5);
  rec.VarArr[0] := 'abc';
  rec.VarArr[1] := 99;
  rec.VarArr[2] := 5.5;
  rec.VarArr[3] := 'xyz';
  rec.VarArr[4] := 33;
  SetLength(rec.Arr, 3);
  rec.Arr[0] := 1.1;
  rec.Arr[1] := 99;
  rec.Arr[2] := 5.5;

  jsn := TJSJSON.stringify(rec);

  res := Calc._CountArray(jsn);
  AddDivText('Sync _CountArray: '+IntToStr(res));

  Calc.CountArray(
    jsn,
    procedure(res: integer)
    begin
      AddDivText('Async CountArray: '+IntToStr(res));
    end,
    procedure(Client: TRestClientURI)
    begin
      console.log('Error calling the CountArray method');
    end);
end;

procedure TMyApplication.TestAdd;
var
  x,y,z: integer;
begin
  // Sync
  x := 5;
  y := 6;
  z := Calc._Add(x,y);
  AddDivText(Format('Sync _Add %d + %d : %d', [x, y, z]));
  // Async
  Calc.Add(x+1, y+1,
    procedure(res: integer)
    begin
      AddDivText(Format('Async Add %d + %d : %d', [x+1, y+1, res]));
    end,
    procedure(Client: TRestClientURI)
    begin
      console.log('Error calling the Add method');
    end);
end;

procedure TMyApplication.TestArrayValue;
var
  i: integer;
  rec: TArrayRec;
  jsn: RawUTF8;
  val: JSValue;
begin
  if Calc=nil then exit;
  SetLength(rec.VarArr, 4);
  rec.VarArr[0] := 'abc';
  rec.VarArr[1] := 99;
  rec.VarArr[2] := 5.5;
  rec.VarArr[3] := 'xyz';

  jsn := TJSJSON.stringify(rec.VarArr);
  i := 3;

  val := Calc._ArrayValue(jsn, i);
  AddDivText(Format('Sync _ArrayValue[%d]: %s', [i, String(val)]));

  i := 2;
  Calc.ArrayValue(
    jsn, i,
    procedure(res: JSValue)
    begin
      AddDivText(Format('Async ArrayValue[%d]: %s', [i, String(res)]));
    end,
    procedure(Client: TRestClientURI)
    begin
      console.log('Error calling the Async ArrayValue method');
    end);
end;

procedure TMyApplication.TestSumArray;
var
  i: integer;
  rec: TArrayRec;
  jsn: RawUTF8;
  res: double;
begin
  SetLength(rec.Arr, 10);
  for i := 0 to 9 do
    rec.Arr[i] := i + 1.1;
  jsn := TJSJSON.stringify(rec);

  res := Calc._SumArray(jsn);
  AddDivText('Sync _SumArray: ' + FloatToStr(res));

  Calc.SumArray(
    jsn,
    procedure(res: double)
    begin
      AddDivText('Async SumArray: ' + FloatToStr(res));
    end,
    procedure(Client: TRestClientURI)
    begin
      console.log('Error calling the SumArray method');
    end);
end;

procedure TMyApplication.TestFullName;
var
  full: RawUtf8;
  size: integer;
begin
  Calc._FullName('John', 'Smith', full, size);
  AddDivText('Sync _FullName: ' + full + '; ' + IntToStr(size));

  Calc.FullName(
    'Merry', 'Alen', full, size,
    procedure(aFullName: RawUtf8; aSize: integer)
    begin
      AddDivText('Async FullName: ' + aFullName + '; ' + IntToStr(aSize));
    end,
    procedure(Client: TRestClientURI)
    begin
      console.log('Error calling the FullName method');
    end);
end;

procedure TMyApplication.TestCat;
var
  pCat: TCat;
  b: Boolean;
begin
  pCat.Name:='Cevin';
  pCat.Sex:=cMale;
  pCat.Birthday:=Date;
  b := Calc._CatIsMale(pCat);
  AddDivText('Sync _CatIsMale M: ' + Str(b));
  pCat.Sex:=cFemale;
  b := Calc._CatIsMale(pCat);
  AddDivText('Sync _CatIsMale F: ' + Str(b));

  pCat := Calc._GetCat;
  AddDivText('Sync _GetCat: ' + TJSJSON.stringify(pCat));
  AddDivText('Sync _GetCat: ' + TJSJSON.stringify(TCat2Variant(pCat)));
end;

procedure TMyApplication.TestPeople;
var
  p: TPeople;
  c: TCat;
begin
  if Calc._GetPeople(123, p) then
  begin
    AddDivText('Sync _GetPeople Name: '+p.FirstName+' '+p.LastName);
    c.Name:='NewCat';
    c.Sex:=cFemale;
    c.Birthday:=IncYear(Date, -4);
    AddDivText('Birthday: '+FormatDateTime('dd.mm.yyyy', c.Birthday));
    if Calc._AddCat2People(c, p) then
    begin
      AddDivText('Sync _AddCat2People: '+TJSJSON.stringify(p));
      AddDivText('Birthday: '+DateToStr(p.Cats[2].Birthday));
    end;
  end;
end;

procedure TMyApplication.AddDivText(const aValue: string);
var
  pDiv: TJSElement;
begin
  pDiv := document.createElement('div');
  pDiv.innerText:=aValue;
  document.body.append(pDiv);
end;

procedure TMyApplication.DoRun;
var
  pDiv: TJSElement;
begin
  // Your code here
  pDiv := document.createElement('div');
  pDiv.innerText:='Test';
  document.body.append(pDiv);

  Connect;
end;

var
  Application : TMyApplication;

begin
  Application:=TMyApplication.Create(nil);
  Application.Initialize;
  Application.Run;
end.
