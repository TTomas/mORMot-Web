unit Web.mORMotClient;

{-------------------------------------------------------------------------------

    This unit was originally generated by a mORMot 1.18.626 server and
    subsequently manually modified for development of mORMot Web.

-------------------------------------------------------------------------------}

{ TODO : Create a Mustache template that works with both TMS WebCore and DWScript. }

interface

uses
  SysUtils,

  //-- WebCore
  JS,
  Web,
  Types,
  //----------

  Web.mORMot.Types,
  Web.mORMot.OrmTypes,
  Web.mORMot.AuthTypes,
  Web.mORMot.RestTypes,
  Web.mORMot.Rest;


type
  /// service accessible via http://localhost:888/root/Calculator
  // - this service will run in sicShared mode
  // - Note that only asynchronous methods are implemented.
  TServiceCalculator = class(TServiceClientAbstract)
  public
    /// will initialize an access to the remote service
    constructor Create(aClient: TRestClientURI); override;

    procedure Add(n1: Integer; n2: Integer;
      onSuccess: TProcedureInt; onError: TRestEvent);
    //function _Add(const n1: Integer; const n2: Integer): Integer;

    procedure ArrayValue(arrJSON: RawUTF8; ix: integer;
      onSuccess: TProcedureString; onError: TRestEvent);

    procedure CountArray(jsn: RawUTF8;
      onSuccess: TProcedureInt; onError: TRestEvent);

    procedure SumArray(jsn: RawUTF8;
      onSuccess: TProcedureDouble; onError: TRestEvent);
  end;


const
  /// the server port, corresponding to http://localhost:888
  SERVER_PORT = 888;


/// return the database Model corresponding to this server
function GetModel: TOrmModel;

/// create a TRestClientHTTP instance and connect to the server
// - it will use by default port 888
// - secure connection will be established via TSQLRestServerAuthenticationDefault
// with the supplied credentials
// - request will be asynchronous, and trigger onSuccess or onError event
procedure GetClient(const aServerAddress, aUserName, aPassword: string;
  onSuccess, onError: TRestEvent; aServerPort: integer = SERVER_PORT);


implementation


function GetModel: TOrmModel;
begin
  result := TOrmModel.Create([TAuthUser, TAuthGroup], 'root');
end;

procedure GetClient(const aServerAddress, aUserName, aPassword: string;
  onSuccess, onError: TRestEvent; aServerPort: integer);
var
  client: TRestClientHTTP;
begin
  client := TRestClientHTTP.Create(aServerAddress, aServerPort, GetModel, true);

  client.Connect(
    procedure(Client: TRestClientURI)
    begin
      try
        if client.ServerTimeStamp = 0 then begin
          if Assigned(onError) then
            onError(client);
          exit;
        end;

        if not client.SetUser(TRestServerAuthenticationDefault, aUserName, aPassword) then begin
          if Assigned(onError) then
            onError(client);
          exit;
        end;

        if Assigned(onSuccess) then
          onSuccess(client);
      except
        if Assigned(onError) then
          onError(client);
      end;
    end,
    onError);
end;


{ TServiceCalculator }

//------------------------------------------------------------------------------
constructor TServiceCalculator.Create(aClient: TRestClientURI);
begin
  fServiceName := 'Calculator';
  fServiceURI := 'Calculator';
  fInstanceImplementation := sicShared;
  // -- If manually modifying this file then set this to the contract
  // -- generated by the server.
  fContractExpected := '4AA83C4EDC9692F0';
  inherited Create(aClient);
end;
//------------------------------------------------------------------------------
procedure TServiceCalculator.ArrayValue(arrJSON: RawUTF8; ix: integer;
  onSuccess: TProcedureString; onError: TRestEvent);
begin
  fClient.CallRemoteServiceAsynch(self, 'ArrayValue', 1,
  [arrJSON, ix],
  procedure(res: TJSValueDynArray)
  var
    v: JSValue;
  begin
    v := res[0];

    // -- Only test for three types for now.
    if isNumber(v) then
      onSuccess(FloatToStr(toNumber(v)))
    else if isInteger(v) then
      onSuccess(IntToStr(toInteger(v)))
    else if isString(v) then
      onSuccess(JS.toString(v));
  end,
  onError);
end;
//------------------------------------------------------------------------------
procedure TServiceCalculator.CountArray(jsn: RawUTF8; onSuccess: TProcedureInt;
  onError: TRestEvent);
begin
  fClient.CallRemoteServiceAsynch(self, 'CountArray', 1,
  [jsn],
  procedure(res: TJSValueDynArray)
  begin
    onSuccess(toInteger(res[0]));
  end,
  onError);
end;
//------------------------------------------------------------------------------
procedure TServiceCalculator.SumArray(jsn: RawUTF8;
  onSuccess: TProcedureDouble; onError: TRestEvent);
begin
  fClient.CallRemoteServiceAsynch(self, 'SumArray', 1,
  [jsn],
  procedure(res: TJSValueDynArray)
  begin
    onSuccess(toNumber(res[0]));
  end,
  onError);
end;
//------------------------------------------------------------------------------
procedure TServiceCalculator.Add(n1: Integer; n2: Integer;
      onSuccess: TProcedureInt; onError: TRestEvent);
begin
  fClient.CallRemoteServiceAsynch(self, 'Add', 1,
  [n1, n2],
  procedure(res: TJSValueDynArray)
  begin
    onSuccess(toInteger(res[0]));
  end,
  onError);

  // -- The following is the DWScript code.
  {fClient.CallRemoteServiceAsynch(self, 'Add', 1,
    [n1, n2],
    lambda (res: array of Variant)
      onSuccess(res[0]);
    end, onError);}
end;

// -- Remove the synchronous call.
{function TServiceCalculator._Add(const n1: Integer; const n2: Integer): Integer;
begin
  var res := fClient.CallRemoteServiceSynch(self,'Add',1,
    [n1,n2]);
  Result := res[0];
end;}



end.