unit main;

{$H+}

interface

uses js, web, Classes,
  login,
  calculator,
  people,
  Web.mORMot.Types,
  Web.mORMot.Rest,
  Web.mORMot.RestTypes,
  mORMotPas2JsClient;

Type

  { TMainForm }

  TMainForm = class(TComponent)
  private
    menu_calculator : TJSHTMLElement;
    menu_people : TJSHTMLElement;
    menu_logout : TJSHTMLElement;
    view_calc : TJSHTMLElement;
    view_people : TJSHTMLElement;
  private
    fClient: TRestClientURI;

    fLoginView: TLoginView;
    fCalculatorView: TCalculatorView;
    fPeopleView: TPeopleView;
    function CalculatorOnClick(Event: TJSMouseEvent): boolean;
    function PeopleOnClick(Event: TJSMouseEvent): boolean;
    function LogoutOnClick(Event: TJSMouseEvent): boolean;
  Public
    Calc: TServiceCalculator;

    constructor Create(aOwner : TComponent); override;
    Procedure BindElements; virtual;

    procedure Login(const aUser, aPassword: string);
  end;

var
  MainForm: TMainForm;

implementation

function TMainForm.CalculatorOnClick(Event: TJSMouseEvent): boolean;
begin
  view_calc.removeAttribute('Hidden');
  view_people.setAttribute('Hidden','');
end;

function TMainForm.PeopleOnClick(Event: TJSMouseEvent): boolean;
begin
  view_calc.setAttribute('Hidden','');
  view_people.removeAttribute('Hidden');
  fPeopleView.ShowPeople;
end;

function TMainForm.LogoutOnClick(Event: TJSMouseEvent): boolean;
begin
  Calc.Free;
  fClient.SessionClose;
  fClient.Free;
  fClient := nil;
  fPeopleView.ClearPeople;
  fLoginView.Show;
end;

constructor TMainForm.Create(aOwner : TComponent);
begin
  Inherited;
  BindElements;
  fLoginView := TLoginView.Create(self);
  fCalculatorView := TCalculatorView.Create(self);
  fPeopleView := TPeopleView.Create(self);
end;


procedure TMainForm.BindElements;
begin
  menu_calculator:=TJSHTMLElement(document.getelementByID('menu-calculator'));
  menu_people:=TJSHTMLElement(document.getelementByID('menu-people'));
  menu_logout:=TJSHTMLElement(document.getelementByID('menu-logout'));
  view_calc:=TJSHTMLElement(document.getelementByID('view-calc'));
  view_people:=TJSHTMLElement(document.getelementByID('view-people'));

  menu_calculator.onclick:=CalculatorOnClick;
  menu_people.onclick:=PeopleOnClick;
  menu_logout.onclick:=LogoutOnClick;
end;

procedure TMainForm.Login(const aUser, aPassword: string);
begin
  GetClient('127.0.0.1', aUser, aPassword,
    procedure(aClient: TRestClientURI)
    begin
      console.log('Connected');
      fClient := aClient;
      Calc := TServiceCalculator.Create(fClient);
      fLoginView.Hide;
      view_calc.removeAttribute('Hidden');
      view_people.setAttribute('Hidden','');
    end,
    procedure(aClient: TRestClientURI)
    begin
      fLoginView.SmallMessage('Unable to connect to server');
    end)
end;

end.
