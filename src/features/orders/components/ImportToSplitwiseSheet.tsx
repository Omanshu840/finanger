import { useEffect } from "react";
import {
	Sheet,
	SheetContent,
	SheetTitle,
	SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Loader2,
	Users,
	ChevronRight,
	CheckCircle2,
	ArrowLeftRight,
	Check,
	ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedOrder } from "../types";
import { useImportToSplitwise } from "../hooks/useImportToSplitwise";

interface Props {
	order: UnifiedOrder | null;
	open: boolean;
	onClose: () => void;
}

function MemberAvatar({
	member,
}: {
	member: {
		first_name: string;
		last_name: string;
		picture?: { medium?: string };
	};
}) {
	return (
		<Avatar className="h-7 w-7 ring-2 ring-background">
			<AvatarImage src={member.picture?.medium} />
			<AvatarFallback className="text-xs">
				{member.first_name[0]}
				{member.last_name?.[0] ?? ""}
			</AvatarFallback>
		</Avatar>
	);
}

export function ImportToSplitwiseSheet({ order, open, onClose }: Props) {
	const {
		state,
		startImport,
		selectGroup,
		toggleMemberOnItem,
		submitToSplitwise,
		reset,
	} = useImportToSplitwise();

	useEffect(() => {
		if (open && order) startImport(order);
		if (!open) reset();
	}, [open, order?.id]);

	return (
		<Sheet open={open} onOpenChange={(v) => !v && onClose()}>
			<SheetContent
				side="right"
				className={cn(
					// Full height on mobile, bounded on desktop
					"flex flex-col p-0",
					"w-full sm:max-w-lg",
					"h-[100dvh]"
				)}
			>
				{/* Header — fixed, never scrolls */}
				<div className="shrink-0 border-b px-6 py-4">
					<SheetTitle className="flex items-center gap-2 text-base">
						{state.step === "split_items" && (
							<button
								onClick={() => {}}
								className="mr-1 rounded-md p-1 hover:bg-muted"
								aria-label="Back"
							>
								<ChevronLeft className="h-4 w-4" />
							</button>
						)}
						<ArrowLeftRight className="h-4 w-4" />
						Import to Splitwise
					</SheetTitle>
					<SheetDescription className="mt-0.5 text-sm">
						{state.step === "loading_details" && "Fetching order details..."}
						{state.step === "select_group" &&
							"Choose a group to add this expense to"}
						{state.step === "split_items" &&
							`Splitting in ${state.selectedGroup?.name}`}
						{state.step === "submitting" && "Creating expense..."}
						{state.step === "done" && "Expense added successfully"}
					</SheetDescription>
				</div>

				{/* Body — fills remaining height, scrolls independently */}
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					{/* Loading */}
					{(state.step === "loading_details" ||
						state.step === "submitting") && (
							<div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
								<Loader2 className="h-8 w-8 animate-spin text-primary" />
								<p className="text-sm">
									{state.step === "loading_details"
										? "Fetching order details..."
										: "Creating expense..."}
								</p>
							</div>
						)}

					{/* Step 1: Select Group */}
					{state.step === "select_group" && (
						<ScrollArea className="h-full">
							<div className="space-y-2 p-4">
								{state.groups
									.filter((g) => g.id !== 0)
									.sort((a, b) => {
										// Groups with no updated_at fall to bottom
										const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
										const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
										return dateB - dateA;
									})
									.map((group) => (
										<button
											key={group.id}
											onClick={() => selectGroup(group)}
											className={cn(
												"flex w-full items-center gap-3 rounded-xl border p-3.5 text-left",
												"overflow-hidden",           // ← prevents children from bleeding out
												"transition-all hover:bg-muted/40 hover:shadow-sm",
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											)}
										>
											{/* Icon */}
											<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
												<Users className="h-5 w-5 text-muted-foreground" />
											</div>

											{/* Name — min-w-0 is mandatory for truncate to work inside flex */}
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium">{group.name}</p>
												<p className="text-xs text-muted-foreground">
													{group.members.length} member{group.members.length !== 1 ? "s" : ""}
												</p>
											</div>

											<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
										</button>
									))}
							</div>
						</ScrollArea>
					)}

					{/* Step 2: Split Items */}
					{state.step === "split_items" &&
						state.selectedGroup &&
						state.orderDetail && (
							<>
								{/* Scrollable area */}
								<ScrollArea className="h-full min-h-0 flex-1">
									<div className="space-y-4 p-4">
										{/* Bill summary */}
										<div className="rounded-xl border bg-muted/20 p-3">
											<p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
												Bill Summary
											</p>
											<div className="space-y-1.5">
												{state.orderDetail.billLines.map((line, idx) => (
													<div
														key={idx}
														className={cn(
															"flex justify-between text-sm",
															line.isTotal &&
															"mt-1.5 border-t pt-1.5 font-semibold text-foreground",
															!line.isTotal && "text-muted-foreground"
														)}
													>
														<span>{line.label}</span>
														<span
															className={cn(
																"tabular-nums",
																line.amount < 0 &&
																"text-green-600 dark:text-green-400"
															)}
														>
															{line.amount === 0
																? "FREE"
																: `${line.amount < 0 ? "-" : ""}₹${Math.abs(line.amount).toFixed(0)}`}
														</span>
													</div>
												))}
											</div>
										</div>

										<Separator />

										{/* Per-item member assignment */}
										<div className="space-y-3">
											<p className="text-sm font-medium text-muted-foreground">
												Select who shares each item
											</p>
											{state.splits.map((split) => (
												<div
													key={split.item.id}
													className="rounded-xl border p-3 space-y-2.5"
												>
													<div className="flex items-start gap-3">   {/* items-start instead of items-center for long names */}
														{(split.item as any).imageUrl && (
															<img
																src={(split.item as any).imageUrl}
																alt={split.item.id}
																width={44}
																height={44}
																className="h-11 w-11 shrink-0 rounded-lg border object-cover"
																loading="lazy"
															/>
														)}

														{/* min-w-0 is the critical fix — allows truncation inside flex */}
														<div className="min-w-0 flex-1">
															<p className="text-sm font-medium leading-snug line-clamp-2">
																{(split.item as any).label}
															</p>
															{(split.item as any).quantity && (
																<p className="mt-0.5 text-xs text-muted-foreground">
																	{(split.item as any).quantity}
																</p>
															)}
														</div>

														{/* Price — shrink-0 keeps it always visible */}
														<span className="shrink-0 tabular-nums text-sm font-semibold">
															₹{split.item.price.toFixed(0)}
														</span>
													</div>

													{/* Member toggle chips */}
													<div className="flex flex-wrap gap-1.5">
														{state.selectedGroup!.members.map((member) => {
															const selected = split.memberIds.includes(
																member.id
															);
															return (
																<button
																	key={member.id}
																	onClick={() =>
																		toggleMemberOnItem(
																			split.item.id,
																			member.id
																		)
																	}
																	className={cn(
																		"flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
																		selected
																			? "border-primary bg-primary/10 text-primary"
																			: "border-border bg-background text-muted-foreground hover:bg-muted"
																	)}
																>
																	<MemberAvatar member={member} />
																	{member.first_name}
																	{selected && (
																		<Check className="h-3 w-3" />
																	)}
																</button>
															);
														})}
													</div>

													{split.memberIds.length > 0 && (
														<p className="text-xs text-muted-foreground">
															₹
															{(
																split.item.price / split.memberIds.length
															).toFixed(2)}{" "}
															per person
														</p>
													)}
												</div>
											))}
										</div>
									</div>
								</ScrollArea>

								{/* Footer — fixed at bottom, never scrolls */}
								<div className="shrink-0 border-t bg-background px-4 py-4 space-y-3">
									<div className="flex justify-between text-sm font-semibold">
										<span>Total to split</span>
										<span className="tabular-nums">
											₹{state.orderDetail.totalAmount.toFixed(0)}
										</span>
									</div>
									<Button
										className="w-full"
										onClick={submitToSplitwise}
										disabled={state.splits.every(
											(s) => s.memberIds.length === 0
										)}
									>
										Add to Splitwise
									</Button>
								</div>
							</>
						)}

					{/* Done */}
					{state.step === "done" && (
						<div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
							<CheckCircle2 className="h-12 w-12 text-green-500" />
							<div>
								<p className="font-semibold">Expense added!</p>
								<p className="mt-1 text-sm text-muted-foreground">
									Successfully split in {state.selectedGroup?.name}
								</p>
							</div>
							<Button variant="outline" onClick={onClose} className="mt-2">
								Done
							</Button>
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}