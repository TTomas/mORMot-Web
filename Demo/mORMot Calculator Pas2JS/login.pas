unit login;

interface

uses js, web, Classes;

Type

  { TLoginView }

  TLoginView = class(TComponent)
  private
    login_dialog : TJSHTMLElement;
    login_form : TJSHTMLFormElement;
    login_user : TJSHTMLInputElement;
    login_password : TJSHTMLInputElement;
    login_btnsubmit : TJSHTMLInputElement;
    login_msg : TJSHTMLElement;

    function OnSubmit(Event: TEventListenerEvent): boolean;
  Public
    Constructor create(aOwner : TComponent); override;
    Procedure BindElements; virtual;
    procedure SmallMessage(const aMsg: string);
    procedure Show;
    procedure Hide;
  end;

implementation

uses
  main;

{ TLoginView }

function TLoginView.OnSubmit(Event: TEventListenerEvent): boolean;
begin
  MainForm.Login(login_user.value, login_password.value);
end;

constructor TLoginView.create(aOwner: TComponent);
begin
  inherited;
  BindElements;
end;

procedure TLoginView.BindElements;
begin
  login_dialog:=TJSHTMLElement(document.getelementByID('login-dialog'));
  login_form:=TJSHTMLFormElement(document.getelementByID('login-form'));
  login_user:=TJSHTMLInputElement(document.getelementByID('login-user'));
  login_password:=TJSHTMLInputElement(document.getelementByID('login-password'));
  login_btnsubmit:=TJSHTMLInputElement(document.getelementByID('login-btnsubmit'));
  login_msg:= TJSHTMLElement(document.getelementByID('login-msg'));;

  login_form.onsubmit:=OnSubmit;
end;

procedure TLoginView.SmallMessage(const aMsg: string);
begin
  login_msg.innerText:=aMsg;
end;

procedure TLoginView.Show;
begin
  login_dialog.setAttribute('Open','');
end;

procedure TLoginView.Hide;
begin
  login_dialog.removeAttribute('Open');
end;

end.

