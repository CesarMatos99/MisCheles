import '../lib/domain/money_parser.dart';

void main() {
  assert(parseMoneyMinor('123.45') == 12345);
  assert(parseMoneyMinor('123,4') == 12340);
  assert(parseMoneyMinor('0.01') == 1);
  assert(parseMoneyMinor('') == 0);
  assert(parseMoneyMinor('-1') == null);
  assert(parseMoneyMinor('1.234') == null);
  assert(parseMoneyMinor('1,234.56') == null);
  assert(parseMoneyMinor('90071992547409.92') == null);
  print('Money parser checks passed.');
}
