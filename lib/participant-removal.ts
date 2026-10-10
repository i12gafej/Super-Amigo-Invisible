import type {Rule} from './types.ts';
export function ruleContainsPerson(rule:Rule,id:string):boolean{
 if(rule.op==='pair')return rule.giver===id||rule.recipient===id;
 if(rule.op==='NOT')return ruleContainsPerson(rule.rule,id);
 return rule.rules.some(child=>ruleContainsPerson(child,id));
}
