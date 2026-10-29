"""Build workshop v2: pinned BFCL cases + explicitly authored scenarios.
Reference actions are generated before model evaluation. Upstream code is unchanged.
"""
import hashlib, json, subprocess, sys
from copy import deepcopy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'tests'),str(ROOT/'public/benchmarks/bfcl')]
from bfcl_test import replay
from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.travel_booking import TravelAPI
from workshop_bridge import WorkshopWorld
from bfcl_test import DOCS
source=subprocess.check_output(['git','show','f98b7b6:lib/bfcl-suites.json'],cwd=ROOT)
suites=json.loads(source)
for split,cases in suites.items():
 for c in cases:
  changes=[]
  for turn in c['entry']['question']:
   for message in turn:
    old=message['content']; text=old
    if c['family']=='158':text=text.replace("passport starting with", "passport number is")
    if c['family']=='163':text=text.replace('next month November on two days after close of the 14th day in the year 2026','on November 16, 2026')
    if c['family']=='182':text=text.replace('next weekend July 14th, 2026','on July 14th, 2026')
    if c['family']=='167' and 'invoice' in text and 'cancel' in text:
     text+=' If that booking was cancelled, do not call any tool: explain that this simulated service cannot retrieve invoices for cancelled bookings.'
    if c['family']=='194':
     text=text.replace('soon on booking id 1234','soon')
     text=text.replace("once you've gotten full approval",'with my explicit approval now')
     if 'relay my booking-related query' in text:text=text.replace('relay my booking-related query', 'send this exact message about my current booking: "Booking-related query."')
    if text!=old:changes.append({'before':old,'after':text});message['content']=text
  c['provenance']={'kind':'adapted_bfcl' if changes else 'bfcl','sourceId':c['id'],'upstreamCommit':'6ea57973c7a6097fd7c5915698c54c17c5b1b6c8','changes':changes}
  c['skills']=[c['category']]

class Scenario:
 def __init__(self,number,title,split,category='base',*,authenticated=True,missed=None,history=None):
  self.number,self.title,self.split,self.category=number,title,split,category
  self.id=f'multi_turn_{"long_context" if category=="long_context" else "base"}_{number}'
  self.token=f'workshop-token-{number}'; self.card=f'card-{number}'
  self.initial={'random_seed':570000+number,'credit_card_list':{self.card:{'balance':50000.0}},'booking_record':history or {},'access_token':self.token if authenticated else None,'token_expires_in':100 if authenticated else None,'token_type':'Bearer' if authenticated else None,'token_scope':'read_write' if authenticated else None,'budget_limit':None,'user_first_name':'Mina','user_last_name':'Park'}
  self.api=TravelAPI(); self.api._load_scenario(deepcopy(self.initial),category=='long_context')
  self.questions=[]; self.truth=[]; self.missed=missed
 def turn(self,text):self.questions.append([{'role':'user','content':text}] if text else []);self.truth.append([])
 def call(self,name,**args):
  result=getattr(self.api,name)(**args)
  assert not(isinstance(result,dict) and (result.get('error') or any(v is False for k,v in result.items() if k.endswith('status')))),(name,result)
  self.truth[-1].append(name+'('+', '.join(k+'='+repr(v) for k,v in args.items())+')')
  return result
 def book(self,origin,destination,date,cls='economy'):
  return self.call('book_flight',access_token=self.token,card_id=self.card,travel_from=origin,travel_to=destination,travel_date=date,travel_class=cls)['booking_id']
 def auth(self):return f'Use access token {self.token} and card ID {self.card}.'
 def save(self):
  entry={'id':self.id,'question':self.questions,'initial_config':{'TravelAPI':self.initial},'involved_classes':['TravelAPI'],'path':[]}
  if self.missed:entry['missed_function']=self.missed
  c={'id':self.id,'family':str(self.number),'title':self.title,'label':('P' if self.split=='practice' else 'F')+str(len(suites[self.split])+1).zfill(2),'category':self.category,'skills':[self.category,'multi_turn'],'entry':entry,'ground_truth':self.truth,'provenance':{'kind':'authored','version':'workshop-v2','notes':'New teaching scenario using unchanged BFCL TravelAPI and checker; not an official BFCL question.'}}
  result=replay(c);assert result['passed'],(self.id,result)
  w=WorkshopWorld(c,DOCS)
  for _ in self.questions[1:]:w.next('done')
  assert not w.grade('done')['passed'],self.id
  suites[self.split].append(c)

def history(number):
 return {f'reservation-{number}-{i}':{'transaction_id':f'txn-{number}-{i}','travel_date':f'2027-08-{i+1:02d}','travel_from':'SFO','travel_to':'LAX' if i%2==0 else 'BOS','travel_class':'economy' if i<5 else 'business','travel_cost':300.0+i*20,'card_id':f'card-{number}'} for i in range(10)}

# Six additional practice families. Each has an actionable follow-up after any abstention.
s=Scenario(1100,'새 인증과 카드 등록 결과 재사용','practice')
s.turn('Authenticate as Mina Park using client_id workshop-app, client_secret simulated-secret, refresh_token simulated-refresh, grant_type read_write. These are simulated credentials.')
s.token=s.call('authenticate_travel',client_id='workshop-app',client_secret='simulated-secret',refresh_token='simulated-refresh',grant_type='read_write',user_first_name='Mina',user_last_name='Park')['access_token']
s.turn('Register my simulated card: number 4111111111111111, expiration 10/2031, cardholder Mina Park, verification number 321. Use the token just obtained.')
s.card=s.call('register_credit_card',access_token=s.token,card_number='4111111111111111',expiration_date='10/2031',cardholder_name='Mina Park',card_verification_number=321)['card_id']
s.turn('Check the balance of the card you just registered.')
s.call('get_credit_card_balance',access_token=s.token,card_id=s.card);s.save()

s=Scenario(1101,'빠진 날짜를 확인한 뒤 예약하기','practice','miss_param')
s.turn('Please quote an economy flight from ORD to BOS. I have not chosen a date. Ask for it before using any tools.')
s.turn('The date is 2027-02-18.')
s.call('get_flight_cost',travel_from='ORD',travel_to='BOS',travel_date='2027-02-18',travel_class='economy')
s.turn('Book that exact trip. '+s.auth());bid=s.book('ORD','BOS','2027-02-18')
s.turn('Retrieve its invoice.');s.call('retrieve_invoice',access_token=s.token,booking_id=bid);s.save()

s=Scenario(1102,'예산 도구 복구까지 복합 요청 보류','practice','miss_func',missed={'1':['set_budget_limit']})
s.turn('Convert 750 EUR to USD and set my account budget to the converted amount. If either operation is unavailable, do neither until the tool returns. '+s.auth())
s.turn('');usd=s.call('compute_exchange_rate',base_currency='EUR',target_currency='USD',value=750)['exchanged_value'];s.call('set_budget_limit',access_token=s.token,budget_limit=usd)
s.turn('Now change the budget to exactly 800 USD using the same token.');s.call('set_budget_limit',access_token=s.token,budget_limit=800);s.save()

s=Scenario(1103,'서로 다른 두 예약의 지시 대상 구분','practice','memory')
s.turn('Book economy SFO to BOS for 2027-03-02. '+s.auth());first=s.book('SFO','BOS','2027-03-02')
s.turn('Make a separate business reservation SFO to ORD for 2027-03-04, same token and card.');second=s.book('SFO','ORD','2027-03-04','business')
s.turn('Get the invoice for the Boston booking, not Chicago.');s.call('retrieve_invoice',access_token=s.token,booking_id=first)
s.turn('Cancel only Chicago. Keep Boston.');s.call('cancel_booking',access_token=s.token,booking_id=second);s.save()

s=Scenario(1104,'운임 조건에 따라 예약 보류와 재개','practice','conditional')
s.turn('Check the first-class fare SFO to JFK on 2027-04-11. Book only if the fare is at most $40. Do not change my account budget. '+s.auth());cost=s.call('get_flight_cost',travel_from='SFO',travel_to='JFK',travel_date='2027-04-11',travel_class='first')['travel_cost_list'][0];assert 40<cost<=7000
s.turn('I now approve up to $7000. Book that exact trip if it fits. Keep the account budget unchanged.');bid=s.book('SFO','JFK','2027-04-11','first')
s.turn('Get its invoice.');s.call('retrieve_invoice',access_token=s.token,booking_id=bid);s.save()

s=Scenario(1105,'많은 예약 기록에서 조건에 맞는 항목 찾기','practice','long_context',history=history(1105))
s.turn('List my booking history. '+s.auth());s.call('get_booking_history',access_token=s.token)
s.turn('Get the invoice for my SFO to BOS business trip on 2027-08-08.');bid='reservation-1105-7';s.call('retrieve_invoice',access_token=s.token,booking_id=bid)
s.turn('Cancel only that trip.');s.call('cancel_booking',access_token=s.token,booking_id=bid);s.save()

# Ten distinct final families, frozen before the comparison runs.
s=Scenario(2100,'여행자 확인부터 도시 조회와 예약까지','final')
s.turn('Verify traveller Mina Park, date of birth 1996-04-12, complete passport number US7654321.');s.call('verify_traveler_information',first_name='Mina',last_name='Park',date_of_birth='1996-04-12',passport_number='US7654321')
s.turn('Find the airports for London and Paris.');s.call('get_nearest_airport_by_city',location='London');s.call('get_nearest_airport_by_city',location='Paris')
s.turn('Quote business class from the first city to the second on 2027-05-09.');s.call('get_flight_cost',travel_from='LHR',travel_to='CDG',travel_date='2027-05-09',travel_class='business')
s.turn('Book that trip. '+s.auth());s.book('LHR','CDG','2027-05-09','business');s.save()

s=Scenario(2101,'카드 조회와 잔액 확인 후 여행 예약','final')
s.turn('List all registered credit cards.');s.call('get_all_credit_cards')
s.turn('Check the balance of the card whose ID is '+s.card+'. My access token is '+s.token+'.');s.call('get_credit_card_balance',access_token=s.token,card_id=s.card)
s.turn('Set my account budget to $4000.');s.call('set_budget_limit',access_token=s.token,budget_limit=4000)
s.turn('Book economy ORD to LAX for 2027-05-22 using that card and token.');s.book('ORD','LAX','2027-05-22');s.save()

s=Scenario(2102,'결제 카드 누락 후 이어지는 예약과 취소','final','miss_param')
s.turn('Book economy LAX to HND for 2027-06-10 using access token '+s.token+'. I have not supplied a card ID. Ask for it before any tool call.')
s.turn('The card ID is '+s.card+'.');bid=s.book('LAX','HND','2027-06-10')
s.turn('Get the invoice for that booking.');s.call('retrieve_invoice',access_token=s.token,booking_id=bid)
s.turn('Cancel it.');s.call('cancel_booking',access_token=s.token,booking_id=bid);s.save()

s=Scenario(2103,'누락된 여행자 정보 보완과 후속 운임 조회','final','miss_param')
s.turn('Verify traveller Mina Park, complete passport number US774455. My birth date is missing; ask me and use no tool yet.')
s.turn('My birth date is 1992-11-23.');s.call('verify_traveler_information',first_name='Mina',last_name='Park',date_of_birth='1992-11-23',passport_number='US774455')
s.turn('Find the airport for Boston.');s.call('get_nearest_airport_by_city',location='Boston')
s.turn('Quote an economy flight from JFK to that airport on 2027-06-18.');s.call('get_flight_cost',travel_from='JFK',travel_to='BOS',travel_date='2027-06-18',travel_class='economy');s.save()

s=Scenario(2104,'예약과 보험의 전체 실행 가능성 확인','final','miss_func',missed={'1':['purchase_insurance']})
s.turn('Book economy JFK to ORD for 2027-07-05 and purchase comprehensive insurance costing $125 for it. If either capability is unavailable, perform neither action until restored. '+s.auth())
s.turn('');bid=s.book('JFK','ORD','2027-07-05');s.call('purchase_insurance',access_token=s.token,insurance_type='comprehensive',insurance_cost=125,booking_id=bid,card_id=s.card)
s.turn('Retrieve the flight booking invoice.');s.call('retrieve_invoice',access_token=s.token,booking_id=bid);s.save()

s=Scenario(2105,'취소 도구가 돌아온 뒤 기존 예약 취소','final','miss_func',missed={'2':['cancel_booking']})
s.turn('Book business SFO to LAX on 2027-07-14. '+s.auth());bid=s.book('SFO','LAX','2027-07-14','business')
s.turn('Cancel that booking. If cancellation is unavailable, call no other tool and wait for it to return.')
s.turn('');s.call('cancel_booking',access_token=s.token,booking_id=bid);s.save()

s=Scenario(2106,'세 예약의 이전 참조와 취소 상태 유지','final','memory')
s.turn('Book economy ORD to BOS on 2027-09-01. '+s.auth());first=s.book('ORD','BOS','2027-09-01')
s.turn('Separately book business ORD to LAX on 2027-09-03 with the same token and card.');second=s.book('ORD','LAX','2027-09-03','business')
s.turn('Add a third booking, first class SFO to JFK on 2027-09-09, same token and card.');s.book('SFO','JFK','2027-09-09','first')
s.turn('Cancel only the Los Angeles reservation.');s.call('cancel_booking',access_token=s.token,booking_id=second)
s.turn('Get the invoice for the earliest Boston trip, which is still active.');s.call('retrieve_invoice',access_token=s.token,booking_id=first);s.save()

s=Scenario(2107,'확장 예약 기록에서 두 대상 구분','final','long_context',history=history(2107))
s.turn('Show my booking history. '+s.auth());s.call('get_booking_history',access_token=s.token)
s.turn('Cancel only the SFO to LAX business trip on 2027-08-09.');s.call('cancel_booking',access_token=s.token,booking_id='reservation-2107-8')
s.turn('Get the invoice for SFO to BOS business on 2027-08-10. Do not use the cancelled trip.');s.call('retrieve_invoice',access_token=s.token,booking_id='reservation-2107-9');s.save()

s=Scenario(2108,'운임 상한 변경과 중복 예약 방지','final','conditional')
s.turn('Quote a first-class flight JFK to HND for 2027-10-04. Reserve it only if the fare is at most $60. Do not set an account budget. '+s.auth());cost=s.call('get_flight_cost',travel_from='JFK',travel_to='HND',travel_date='2027-10-04',travel_class='first')['travel_cost_list'][0];assert 60<cost<=10000
s.turn('My new approved maximum fare is $10000. Book the same trip if it fits; leave account budget unchanged.');bid=s.book('JFK','HND','2027-10-04','first')
s.turn('Please show the invoice of that existing reservation. Do not create another reservation.');s.call('retrieve_invoice',access_token=s.token,booking_id=bid);s.save()

s=Scenario(2109,'명시적인 취소 요청이 오기 전 행동 보류','final','conditional')
s.turn('Book economy SFO to ORD for 2027-10-19. '+s.auth());bid=s.book('SFO','ORD','2027-10-19')
s.turn('I might change my plans, but I have not decided. Do not cancel, look anything up, or call any tool yet; just acknowledge.')
s.turn('I have decided: cancel that reservation now.');s.call('cancel_booking',access_token=s.token,booking_id=bid);s.save()

for split,cases in suites.items():
 for i,c in enumerate(cases):
  c['label']=('P' if split=='practice' else 'F')+str(i+1).zfill(2)
  assert replay(c)['passed'],c['id']
assert [len(suites[k]) for k in ['practice','final']]==[12,30]
assert not({c['family'] for c in suites['practice']}&{c['family'] for c in suites['final']})
output=json.dumps(suites,ensure_ascii=False,indent=2)+'\n'
(ROOT/'lib/bfcl-suites.json').write_text(output)
summary={'version':'bfcl-travel-v2','sourceFileSha256':hashlib.sha256(source).hexdigest(),'suiteSha256':hashlib.sha256(output.encode()).hexdigest(),'splits':{split:{'count':len(cases),'families':len({c['family'] for c in cases}),'categories':{category:sum(c['category']==category for c in cases) for category in sorted({c['category'] for c in cases})},'turns':sum(len(c['entry']['question']) for c in cases),'provenance':{kind:sum(c['provenance']['kind']==kind for c in cases) for kind in ['bfcl','adapted_bfcl','authored']}} for split,cases in suites.items()}}
(ROOT/'docs/benchmark-v2-manifest.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False,indent=2))
