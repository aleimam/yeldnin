Please discuss this module deeply with me and ask as many questions as you need to guarantee deep understanding of the task

Evaluation Module

1. I want to add new module to enable employees to evaluate each other\.  
I want to select good title for that module \(360 Degree / Appraisals / P2P Reviews / Feedback / Evaluations – please suggest\)
2. There will be pool of criteria that employees evaluate each other against\. Each criterion has Title and Text\. In some pillars like attitude, communication skills, integrity and others – please suggest ideal pillars  
Pillars and criteria are admin editable
3. Each criterion can be answered by selecting; Outstanding, Good, Fair, Bad, Worst
4. Answers give scores 5, 4, 3, 2 and 1
5. Each evaluation should have a comment \(Required\) – one comment on the whole evaluation per person
6. Criteria are grouped in Groups \(Pillars\); and each criterion is added to one group – each group \(pillar\) can be applicable / non applicable to user teams

Edits to current HR Module

1. Each employee has a position; positions have Grades from 1 to 7 \(Select from list\)
	1. Evaluations from same level of the employee will be weighted by 1, evaluations from higher levels are weighted with 2 and evaluations from lower levels are weighted with 0\.5
2. In Department details, each department has connected departments\.

Back to Evaluations module

1. If the evaluation is from an employee in the same department, then weight it by 4 \(Give it weight of 4\)
2. If the evaluation is from an employee in a connected department, then weight it by 2 \(Give it weight of 2\)
3. If the evaluation is from an employee in non\-connected department, then weight it by 1 \(Give it weight of 1\)
4. Admins should be able to add connected departments to each department
5. Connected departments are reciprocating – if Department \(A\) is connected department to department \(B\), then Department \(B\) is connected department to department \(A\), system should update it directly
6. Users don’t see connected department, weights of evaluations or weight of level of positions
7. Evaluations from employees from same department will have weight of 4
8. There should be Evaluation matrix, admins will define for each department who which departments can evaluate them\. Admin will add 2 groups of departments;
	1. Connected Departments >> Evaluation weight is 2
	2. Non\-connected Departments >> Evaluation weight is 1

Evaluation Process

1. Admin will start new evaluation cycle in the system and give it deadline
2. At the end of the Evaluation cycle, evaluation close – admin can extend or change deadlines
3. Admin can see who completed his evaluations
4. When an employee starts new evaluation cycle, he will see list of all employees from all teams that his team has ability to evaluate them\. Employees will see list of all employees who have authority to evaluate
5. Employee can select employees who will be skipped – the employee doesn’t have enough information about them and can’t evaluate
	1. Evaluator can select N/A for any employee to ignore evaluating him
	2. Selecting Not Applicable for an employee will skip his evaluation – this means that the evaluator can’t evaluate this employee\.
	3. All criteria in the evaluation form are optional
	4. Note is required for any evaluated criteria
6. Employee must submit all evaluations for all staff to get his evaluation cycle close \(complete\),
7. Keep notifying and reminding employee to complete his evaluation cycle
8. Please add Gender \(list of Male of Female\) to employee details

Normalization

1. I want to normalize all evaluations of every evaluator to 80% \- this means that the average of all evaluations done by any employee should by 4 out of 5
2. Normalized scores will be used in all analytics and exports

After deadline closes

1. System should be able to export sheet of all \(CSV\) of all evaluations \(Criteria answered\) with its comments for all employees\.
2. For every employee, system will show analytics of evaluations \(Per criterion, per Criterion group and Aggregate\)
3. System should show analytics per department \(Per criterion, per Criterion group and Aggregate\)
4. System should show aggregate analytics for all staff \(Per criterion, per Criterion group and Aggregate\)

