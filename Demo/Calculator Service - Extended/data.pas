unit data;

interface

{$I mormot.defines.inc}
uses
  mormot.core.base,
  mormot.core.data,
  mormot.core.json,
  mormot.core.interfaces,
  mormot.core.rtti,
  mormot.orm.base,
  mormot.orm.core;

const
  HttpPort = '888';
  ROOT_NAME = 'root';


type
  TSex = (cMale, cFemale);

  TCat = packed record
    Name: RawUtf8;
    Sex: TSex;
    Birthday: TDateTime;
  end;

  ICalculator = interface(IInvokable)
    ['{9A60C8ED-CEB2-4E09-87D4-4A16F496E5FE}']
    function Add(n1, n2: integer): integer;
    function ArrayValue(const arrJSON: RawUtf8; ix: integer): variant;
    function CountArray(const jsn: RawUtf8): integer;
    function SumArray(const jsn: RawUtf8): double;
    procedure FullName(const aFirstName, aLastName: RawUtf8;
      var aFullName: RawUtf8; var aSize: integer);
    function CatIsMale(const aCat: TCat): Boolean;
    function GetCat: TCat;
  end;

{$ifdef FPC}
const
  __TCat = 'Name RawUtf8 Sex TSex Birthday TDateTime';
{$endif}

implementation




initialization

  {$ifdef FPC}
  Rtti.RegisterType(TypeInfo(TSex));
  Rtti.RegisterFromText(TypeInfo(TCat),__TCat);
  {$endif}
  TInterfaceFactory.RegisterInterfaces([TypeInfo(ICalculator)]);

end.
