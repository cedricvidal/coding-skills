unset PROMPT_COMMAND
export PS1='\[\033[1;36m\]demo $ \[\033[0m\]'
export PS2='> '
export HISTFILE=/dev/null
export HISTSIZE=0
export HISTFILESIZE=0
set +o history
set +H
export PAGER=cat
export GIT_PAGER=cat
export TERM=xterm-256color
bind 'set enable-bracketed-paste off'
printf '\033[2J\033[H'
