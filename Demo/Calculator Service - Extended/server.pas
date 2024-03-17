unit server;

interface

{$mode Delphi}
{$I mormot.defines.inc}
uses
  SysUtils,
  DateUtils,
  mormot.core.base,
  mormot.core.data,
  mormot.core.json,
  mormot.core.rtti,
  mormot.core.unicode,
  mormot.core.variants,
  mormot.orm.core,
  mormot.orm.rest,
  mormot.rest.server,
  mormot.rest.memserver,
  mormot.soa.core,
  mormot.soa.server,
  mormot.rest.sqlite3,
  mormot.db.raw.sqlite3.static,
  data;

type

  { TCalculatorService }

  TCalculatorService = class(TInjectableObjectRest, ICalculator)
  public
    function Add(n1, n2: integer): integer;
    function ArrayValue(const arrJSON: RawUtf8; ix: integer): variant;
    function CountArray(const jsn: RawUtf8): integer;
    function SumArray(const jsn: RawUtf8): double;
    procedure FullName(const aFirstName, aLastName: RawUtf8;
      var aFullName: RawUtf8; var aSize: integer);
    function CatIsMale(const aCat: TCat): Boolean;
    function GetCat: TCat;
    function GetPeople(aId: integer; var aPeople: TPeople): Boolean;
    function AddPeople(const aPeople: TPeople): integer;
    function AddCat2People(const aCat: TCat; var aPeople: TPeople): boolean;
  end;

  TArrayRec = packed record
    Arr: TDoubleDynArray;
    VarArr: TVariantDynArray;
  end;

{$ifdef FPC}
const
  __TArrayRec = 'Arr TDoubleDynArray VarArr TVariantDynArray';
{$endif}

  {TCalcServerAuthentication = class(TRestServerAuthenticationHttpBasic)
  public
    constructor Create(aServer: TRestServer); override;
    function Auth(Ctxt: TRestServerURIContext): boolean; override;
  end;

  TCalculatorServer = class(TRestServerFullMemory)
  public
    constructor CreateWithOwnModel; overload;
  end;}

implementation



{
******************************** TCalculatorServer *****************************
}
{constructor TCalculatorServer.CreateWithOwnModel;
var
  factory: TServiceFactoryServerAbstract;
begin
  inherited CreateWithOwnModel([], true, 'root');
  //AuthenticationRegister(TRestServerAuthenticationNone);
  //AuthenticationRegister(TCalcServerAuthentication);
  factory := ServiceDefine(TCalculatorService, [ICalculator], sicShared);
  // -- Use ByPassAuthentication to allow unrestricted access.
  //factory.ByPassAuthentication := true;
end;}


{ TExampleService }

//------------------------------------------------------------------------------
function TCalculatorService.Add(n1, n2: integer): integer;
begin
  result := n1 + n2;
end;
//------------------------------------------------------------------------------
function TCalculatorService.ArrayValue(const arrJSON: RawUtf8;
  ix: integer): variant;
var
  arr: TVariantDynArray;
begin
  DynArrayLoadJSON(arr, @arrJSON[1], TypeInfo(TVariantDynArray));
  result := arr[ix];
end;
//------------------------------------------------------------------------------
function TCalculatorService.CountArray(const jsn: RawUtf8): integer;
var
  i: integer;
  rec: TArrayRec;
begin
  RecordLoadJSON(rec, jsn, TypeInfo(TArrayRec));
  result := Length(rec.VarArr);
end;
//------------------------------------------------------------------------------
function TCalculatorService.SumArray(const jsn: RawUtf8): double;
var
  i: integer;
  rec: TArrayRec;
begin
  RecordLoadJSON(rec, @jsn[1], TypeInfo(TArrayRec));
  result := 0;
  for i := 0 to Length(rec.Arr) do
    result := result + rec.Arr[i];
end;

procedure TCalculatorService.FullName(const aFirstName, aLastName: RawUtf8;
  var aFullName: RawUtf8; var aSize: integer);
begin
  aFullName := aFirstName + ' ' + aLastName;
  aSize := Length(aFullName);
end;

function TCalculatorService.CatIsMale(const aCat: TCat): Boolean;
begin
  Result := aCat.Sex = cMale;
  writeln(FormatDateTime('dd.mm.yyyy', aCat.Birthday));
end;

function TCalculatorService.GetCat: TCat;
begin
  Result.Name:='Test Name';
  Result.Sex:=cFemale;
  Result.Birthday:=Date;
end;

function TCalculatorService.GetPeople(aId: integer;
  var aPeople: TPeople): Boolean;
var
  i: integer;
  c: TCat;
begin
  with aPeople do
  begin
    FirstName:='Mark';
    LastName:='Smith';
    Birthday:=Now;
    Sex:=cMale;
    Cat.Name:='OneCat';
    Cat.Birthday:=IncYear(Date, -1);
    Cat.Sex:=cMale;
    CatNested.Name:='NestedOne';
    CatNested.Birthday:=IncYear(Date, -3);
    CatNested.Sex:=cFemale;
    for i:=Low(Cat3) to High(Cat3) do
    begin
      Cat3[i].Name:='Static '+IntToStr(i+1);
      Cat3[i].Birthday:=IncYear(Date, -i);
      Cat3[i].Sex:=TSex(i mod 2);
    end;
    SetLength(Cats, 2);
    for i:=Low(Cats) to High(Cats) do
    begin
      Cats[i].Name:='Dynamic '+IntToStr(i+1);
      Cats[i].Birthday:=IncYear(Date, -i*2);
      Cats[i].Sex:=TSex(i mod 2);
    end;
    SetLength(CatsNested, 3);
    for i:=Low(CatsNested) to High(CatsNested) do
    begin
      CatsNested[i].Name:='Nested Dyn'+IntToStr(i+1);
      CatsNested[i].Birthday:=IncYear(Date, -i*2);
      CatsNested[i].Sex:=TSex(i mod 2);
    end;
  end;
  Result := True;
end;

function TCalculatorService.AddPeople(const aPeople: TPeople): integer;
begin
  Result := random(9999);
end;

function TCalculatorService.AddCat2People(const aCat: TCat;
  var aPeople: TPeople): boolean;
begin
  if aCat.Name='' then
    Result := False
  else
  begin
    DynArrayAdd(TypeInfo(TCatDynArray), aPeople.Cats, aCat);
    Result := True;
  end;
end;



{ TCalcServerAuthentication }

//------------------------------------------------------------------------------
//-- We could create custom authentication but this would still require the
//-- initiation of a service.
{function TCalcServerAuthentication.Auth(Ctxt: TRestServerURIContext): boolean;
var
  uname: RawUtf8;
begin
  uname := Ctxt.InputUtf8OrVoid['UserName'];
  if uname = '' then
    uname := 'Guest';

  result := true;
end;
//------------------------------------------------------------------------------
constructor TCalcServerAuthentication.Create(aServer: TRestServer);
begin
  inherited Create(aServer);

end;}



{$ifdef FPC}
initialization
  Rtti.RegisterType(TypeInfo(TDoubleDynArray));
  Rtti.RegisterType(TypeInfo(TVariantDynArray));
  Rtti.RegisterFromText(TypeInfo(TArrayRec), __TArrayRec);
{$endif}

end.
