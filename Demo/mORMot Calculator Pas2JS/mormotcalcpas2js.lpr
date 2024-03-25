program mormotcalcpas2js;

uses
  BrowserApp, JS, Classes, SysUtils, Web,
  main, calculator, people;

type

  { TMyApplication }

  TMyApplication = class(TBrowserApplication)
  protected
    procedure DoRun; override;
  public
  end;

procedure TMyApplication.DoRun;
begin
  // Your code here
  MainForm := TMainForm.Create(self);
end;

var
  Application : TMyApplication;

begin
  Application:=TMyApplication.Create(nil);
  Application.Initialize;
  Application.Run;
end.
