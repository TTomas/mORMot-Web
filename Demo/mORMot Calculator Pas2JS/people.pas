unit people;

interface

uses Classes, SysUtils,
  js, web, Types,
  Web.mORMot.Types,
  Web.mORMot.Rest,
  mORMotPas2JsClient;

type

  { TPeopleView }

  TPeopleView = class(TComponent)
  private
    ppl_get_id : TJSHTMLInputElement;
    ppl_get_btnsync : TJSHTMLButtonElement;
    ppl_get_btnasync : TJSHTMLButtonElement;
    ppl_form_addcat : TJSHTMLElement;
    ppl_c2p_name : TJSHTMLInputElement;
    ppl_c2p_birth : TJSHTMLInputElement;
    ppl_c2p_male : TJSHTMLInputElement;
    ppl_c2p_female : TJSHTMLInputElement;
    ppl_c2p_btnsync : TJSHTMLButtonElement;
    ppl_c2p_btnasync : TJSHTMLButtonElement;
    ppl_card : TJSHTMLElement;
    ppl_firstname : TJSHTMLInputElement;
    ppl_lastname : TJSHTMLInputElement;
    ppl_birthday : TJSHTMLInputElement;
    ppl_sex : TJSHTMLElement;
    ppl_cat_name : TJSHTMLInputElement;
    ppl_cat_birth : TJSHTMLInputElement;
    ppl_cat_sex : TJSHTMLElement;
    ppl_cats : TJSHTMLElement;
  private
    fPeople: TPeople;
    function TSex2String(Value: TSex): string;

    function GetPeopleSyncOnClick(Event: TJSMouseEvent): boolean;
    function GetPeopleAsyncOnClick(Event: TJSMouseEvent): boolean;

    function AddCat2PeopleSyncOnClick(Event: TJSMouseEvent): boolean;
    function AddCat2PeopleAsyncOnClick(Event: TJSMouseEvent): boolean;
  Public
    constructor Create(aOwner : TComponent); override;
    Procedure BindElements; virtual;
  Public
    procedure ClearPeople;
    procedure ShowPeople;
  end;

implementation

uses main;

{ TPeopleView }

procedure TPeopleView.ShowPeople;
var
  c: TCat;
  pCard, pFs, pLb, pIn: TJSElement;
begin
  if fPeople.FirstName='' then
  begin
    ppl_form_addcat.setAttribute('hidden','');
    ppl_card.setAttribute('hidden','');
    exit;
  end;

  ppl_firstname.value:=fPeople.FirstName;
  ppl_lastname.value:=fPeople.LastName;
  ppl_birthday.value:=DateToStr(fPeople.Birthday);
  ppl_sex.innerText:= TSex2String(fPeople.Sex);

  ppl_cat_name.value:=fPeople.Cat.Name;
  ppl_cat_birth.value:=DateToStr(fPeople.Cat.Birthday);
  ppl_cat_sex.innerText:=TSex2String(fPeople.Cat.Sex);

  ppl_cats.innerHTML:='';
  for c in fPeople.Cats do
  begin
    pCard := document.createElement('article');
    pFs := document.createElement('fieldset');
    pFs.setAttribute('class', 'grid');
    pCard.append(pFs);
    pLb := document.createElement('label');
    pLb.innerText:='Name';
    pIn := document.createElement('input');
    pIn.setAttribute('value', c.Name);
    pLb.append(pIn);
    pFs.append(pLb);

    pLb := document.createElement('label');
    pLb.innerText:='Birthday';
    pIn := document.createElement('input');
    pIn.setAttribute('value', DateToStr(c.Birthday));
    pLb.append(pIn);
    pFs.append(pLb);

    pLb := document.createElement('label');
    pLb.innerText:='Sex';
    pIn := document.createElement('div');
    pIn.innerText := TSex2String(c.Sex);
    pLb.append(pIn);
    pFs.append(pLb);

    ppl_cats.append(pCard);
//    <article>
//      <fieldset class="grid">
//        <label>Name<input value=""/></label>
//        <label>Birthday<input value=""/></label>
//        <label>Sex<div></div></label>
//      </fieldset>
//    </article>
  end;

  ppl_form_addcat.removeAttribute('hidden');
  ppl_card.removeAttribute('hidden');
end;

procedure TPeopleView.ClearPeople;
begin
  fPeople.FirstName:='';
  fPeople.LastName:='';
  fPeople.Birthday:=0;
  SetLength(fPeople.Cats, 0);
  // ...
end;

function TPeopleView.TSex2String(Value: TSex): string;
begin
  if Value=cMale then
    Result := 'Male'
  else
    Result := 'Female';
end;

function TPeopleView.GetPeopleSyncOnClick(Event: TJSMouseEvent): boolean;
begin
  if MainForm.Calc._GetPeople(StrToInt(ppl_get_id.value), fPeople) then
    ShowPeople;
end;

function TPeopleView.GetPeopleAsyncOnClick(Event: TJSMouseEvent): boolean;
begin
  MainForm.Calc.GetPeople(StrToInt(ppl_get_id.value), fPeople,
    procedure(aPeople: TPeople; aResult: Boolean)
    begin
      if aResult then
      begin
        fPeople := aPeople;
        ShowPeople;
      end;
    end,
    procedure(Client: TRestClientURI)
    begin
      console.log('Error calling the GetPeople method');
    end);
end;

function TPeopleView.AddCat2PeopleSyncOnClick(Event: TJSMouseEvent): boolean;
var
  pCat: TCat;
begin
  pCat.Name:=ppl_c2p_name.value;
  pCat.Birthday:=StrToDate(ppl_c2p_birth.value);
  if ppl_c2p_male.checked then
    pCat.Sex:=cMale
  else
    pCat.Sex:=cFemale;
  if MainForm.Calc._AddCat2People(pCat, fPeople) then
    ShowPeople;
end;

function TPeopleView.AddCat2PeopleAsyncOnClick(Event: TJSMouseEvent): boolean;
var
  pCat: TCat;
begin
  pCat.Name:=ppl_c2p_name.value;
  pCat.Birthday:=StrToDate(ppl_c2p_birth.value);
  if ppl_c2p_male.checked then
    pCat.Sex:=cMale
  else
    pCat.Sex:=cFemale;
  MainForm.Calc.AddCat2People(pCat, fPeople,
    procedure(aPeople: TPeople; aResult: Boolean)
    begin
      if aResult then
      begin
        fPeople := aPeople;
        ShowPeople;
      end;
    end,
    procedure(Client: TRestClientURI)
    begin
      console.log('Error calling the AddCat2People method');
    end);
end;

constructor TPeopleView.Create(aOwner: TComponent);
begin
  inherited;
  BindElements;
end;

procedure TPeopleView.BindElements;
begin
  ppl_get_id:=TJSHTMLInputElement(document.getelementByID('ppl-get-id'));
  ppl_get_btnsync:=TJSHTMLButtonElement(document.getelementByID('ppl-get-btnsync'));
  ppl_get_btnasync:=TJSHTMLButtonElement(document.getelementByID('ppl-get-btnasync'));
  ppl_form_addcat:=TJSHTMLElement(document.getelementByID('ppl-form-addcat'));
  ppl_c2p_name:=TJSHTMLInputElement(document.getelementByID('ppl-c2p-name'));
  ppl_c2p_birth:=TJSHTMLInputElement(document.getelementByID('ppl-c2p-birth'));
  ppl_c2p_male:=TJSHTMLInputElement(document.getelementByID('ppl-c2p-male'));
  ppl_c2p_female:=TJSHTMLInputElement(document.getelementByID('ppl-c2p-female'));
  ppl_c2p_btnsync:=TJSHTMLButtonElement(document.getelementByID('ppl-c2p-btnsync'));
  ppl_c2p_btnasync:=TJSHTMLButtonElement(document.getelementByID('ppl-c2p-btnasync'));
  ppl_card:=TJSHTMLElement(document.getelementByID('ppl-card'));
  ppl_firstname:=TJSHTMLInputElement(document.getelementByID('ppl-firstname'));
  ppl_lastname:=TJSHTMLInputElement(document.getelementByID('ppl-lastname'));
  ppl_birthday:=TJSHTMLInputElement(document.getelementByID('ppl-birthday'));
  ppl_sex:=TJSHTMLElement(document.getelementByID('ppl-sex'));
  ppl_cat_name:=TJSHTMLInputElement(document.getelementByID('ppl-cat-name'));
  ppl_cat_birth:=TJSHTMLInputElement(document.getelementByID('ppl-cat-birth'));
  ppl_cat_sex:=TJSHTMLElement(document.getelementByID('ppl-cat-sex'));
  ppl_cats:=TJSHTMLElement(document.getelementByID('ppl-cats'));

  ppl_get_btnsync.onclick:=@GetPeopleSyncOnClick;
  ppl_get_btnasync.onclick:=@GetPeopleAsyncOnClick;

  ppl_c2p_btnsync.onclick:=@AddCat2PeopleSyncOnClick;
  ppl_c2p_btnasync.onclick:=@AddCat2PeopleAsyncOnClick;

  ShowPeople;
end;

end.

